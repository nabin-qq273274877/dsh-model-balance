/**
 * Custom provider configuration loader.
 *
 * Reads provider definitions from JSON config files:
 * 1. Plugin's bundled providers.json (default providers)
 * 2. User's ~/.dsh/model-balance-providers.json (custom overrides/additions)
 *
 * Supports advanced parsing:
 * - Simple JSON path: "data.balance"
 * - Array find: { "path": "items", "find": { "field": "currency", "equals": "CNY" }, "value": "amount" }
 * - Expression: { "expr": "(data.limit - data.usage) / 100" }
 */

import type { BalanceQueryResult, CurrencyResult, QuotaResult } from "../types.js"
import { readFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { homedir } from "node:os"
import { fileURLToPath } from "node:url"

// ---------------------------------------------------------------------------
// Config file types
// ---------------------------------------------------------------------------

/** Simple JSON path accessor */
interface SimplePath {
  readonly path: string
}

/** Array find + value extraction */
interface ArrayFindPath {
  /** Path to the array, e.g. "balance_infos" */
  readonly path: string
  /** Find condition */
  readonly find: {
    /** Field name in array items to match */
    readonly field: string
    /** Expected value */
    readonly equals: string | number
  }
  /** Field to extract from the found item */
  readonly value: string
}

/** Expression-based calculation */
interface ExprPath {
  /** Expression using JSON paths, e.g. "(data.limit - data.usage) / 100" */
  readonly expr: string
}

type PathConfig = string | SimplePath | ArrayFindPath | ExprPath

interface CurrencyResponseConfig {
  readonly type: "currency"
  /** ISO 4217 currency code (default: "CNY") */
  readonly currency?: string
  /** Balance accessor (simple path, array find, or expression) */
  readonly balance: PathConfig
  /** Optional: available flag accessor */
  readonly available?: string
}

interface QuotaResponseConfig {
  readonly type: "quota"
  /** Limit accessor */
  readonly limit: PathConfig
  /** Used accessor */
  readonly used: PathConfig
  /** Remaining accessor */
  readonly remaining: PathConfig
  /** Optional: reset time accessor */
  readonly resetTime?: string
}

type ResponseConfig = CurrencyResponseConfig | QuotaResponseConfig

export interface CustomProviderConfig {
  /** Display name */
  readonly name?: string
  /** Base URL of the provider API */
  readonly baseURL: string
  /** Endpoint path (appended to baseURL) */
  readonly endpoint: string
  /** Environment variable name containing the API key */
  readonly keyEnv: string
  /** How to parse the response */
  readonly response: ResponseConfig
  /** Optional aliases (alternative provider IDs) */
  readonly aliases?: readonly string[]
}

export interface CustomProvidersFile {
  readonly providers?: Record<string, CustomProviderConfig>
}

// ---------------------------------------------------------------------------
// JSON path accessor
// ---------------------------------------------------------------------------

/**
 * Get a nested value from an object using dot notation.
 * e.g. getByPath({ data: { balance: 100 } }, "data.balance") → 100
 */
function getByPath(obj: unknown, path: string): unknown {
  const keys = path.split(".")
  let current: unknown = obj
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined
    }
    // Support array index: "items.0" → items[0]
    if (Array.isArray(current) && /^\d+$/.test(key)) {
      current = current[Number(key)]
    } else {
      current = (current as Record<string, unknown>)[key]
    }
  }
  return current
}

/**
 * Resolve a PathConfig to an actual value from the response body.
 */
function resolvePath(body: unknown, config: PathConfig): unknown {
  // String: simple path
  if (typeof config === "string") {
    return getByPath(body, config)
  }

  // Object with just "path": simple path
  if ("path" in config && !("find" in config) && !("expr" in config)) {
    return getByPath(body, (config as SimplePath).path)
  }

  // Array find: { path, find, value }
  if ("find" in config) {
    const arrConfig = config as ArrayFindPath
    const arr = getByPath(body, arrConfig.path)
    if (!Array.isArray(arr)) return undefined

    const item = arr.find((entry: unknown) => {
      if (entry === null || entry === null || typeof entry !== "object") return false
      const fieldValue = (entry as Record<string, unknown>)[arrConfig.find.field]
      return fieldValue === arrConfig.find.equals
    })

    if (item === undefined) return undefined
    return (item as Record<string, unknown>)[arrConfig.value]
  }

  // Expression: { expr }
  if ("expr" in config) {
    const exprConfig = config as ExprPath
    return evaluateExpr(body, exprConfig.expr)
  }

  return undefined
}

/**
 * Simple expression evaluator.
 * Replaces JSON paths in expression with actual values, then evaluates.
 * e.g. "(data.limit - data.usage) / 100" with body={data:{limit:5000,usage:1234}} → 37.66
 */
function evaluateExpr(body: unknown, expr: string): unknown {
  // Replace path references with values
  // Match identifiers like "data.limit", "balance_infos.0.total_balance", etc.
  const resolved = expr.replace(/([a-zA-Z_][\w.]*)/g, (match) => {
    // Skip JS keywords
    if (["true", "false", "null", "undefined", "NaN", "Infinity"].includes(match)) {
      return match
    }
    const value = getByPath(body, match)
    if (value === undefined || value === null) return "NaN"
    if (typeof value === "string") return JSON.stringify(value)
    return String(value)
  })

  try {
    // Use Function constructor for safe evaluation (no access to outer scope)
    const fn = new Function(`"use strict"; return (${resolved})`)
    return fn()
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------------------
// Config parser builders
// ---------------------------------------------------------------------------

function buildCurrencyParser(config: CurrencyResponseConfig): (body: unknown) => CurrencyResult {
  return (body: unknown): CurrencyResult => {
    const balance = Number(resolvePath(body, config.balance))
    if (!Number.isFinite(balance)) {
      throw new Error(`balance is not numeric`)
    }
    const available = config.available
      ? Boolean(getByPath(body, config.available))
      : undefined
    return {
      queryable: true,
      kind: "currency",
      currency: config.currency ?? "CNY",
      balance,
      ...(available !== undefined ? { available } : {}),
    }
  }
}

function buildQuotaParser(config: QuotaResponseConfig): (body: unknown) => QuotaResult {
  return (body: unknown): QuotaResult => {
    const limit = Number(resolvePath(body, config.limit))
    const used = Number(resolvePath(body, config.used))
    const remaining = Number(resolvePath(body, config.remaining))
    if (!Number.isFinite(limit) || !Number.isFinite(used) || !Number.isFinite(remaining)) {
      throw new Error(`quota values are not numeric`)
    }
    const resetTime = config.resetTime
      ? getByPath(body, config.resetTime)
      : undefined
    return {
      queryable: true,
      kind: "quota",
      unit: "requests",
      limit,
      used,
      remaining,
      ...(typeof resetTime === "string" ? { resetTime } : {}),
    }
  }
}

function buildParser(response: ResponseConfig): (body: unknown) => BalanceQueryResult {
  if (response.type === "currency") {
    return buildCurrencyParser(response)
  }
  return buildQuotaParser(response)
}

// ---------------------------------------------------------------------------
// Config file loading
// ---------------------------------------------------------------------------

const USER_CONFIG_FILE = "model-balance-providers.json"
const BUNDLED_CONFIG_FILE = "providers.json"

/**
 * Get the path to the bundled providers.json (next to this module).
 */
function getBundledConfigPath(): string {
  try {
    const currentDir = typeof __dirname !== "undefined"
      ? __dirname
      : dirname(fileURLToPath(import.meta.url))
    return join(currentDir, "..", "..", BUNDLED_CONFIG_FILE)
  } catch {
    return join(process.cwd(), BUNDLED_CONFIG_FILE)
  }
}

/**
 * Get the path to the user's config file.
 */
function getUserConfigPath(): string {
  const envPath = process.env.DSH_MODEL_BALANCE_CONFIG
  if (envPath) return envPath
  return join(homedir(), ".dsh", USER_CONFIG_FILE)
}

let cachedCustomStrategies: Record<string, {
  readonly suffix: string
  readonly defaultBaseURL: string
  readonly defaultKeyEnv: string
  readonly parse: (body: unknown) => BalanceQueryResult
  readonly aliases?: readonly string[]
}> | null = null

/**
 * Parse a config file and return strategies.
 */
function parseConfigFile(configPath: string): Record<string, {
  readonly suffix: string
  readonly defaultBaseURL: string
  readonly defaultKeyEnv: string
  readonly parse: (body: unknown) => BalanceQueryResult
  readonly aliases?: readonly string[]
}> {
  if (!existsSync(configPath)) return {}

  try {
    const raw = readFileSync(configPath, "utf-8")
    const file = JSON.parse(raw) as CustomProvidersFile

    if (!file.providers || typeof file.providers !== "object") return {}

    const result: Record<string, {
      readonly suffix: string
      readonly defaultBaseURL: string
      readonly defaultKeyEnv: string
      readonly parse: (body: unknown) => BalanceQueryResult
      readonly aliases?: readonly string[]
    }> = {}

    for (const [id, config] of Object.entries(file.providers)) {
      // Skip keys starting with underscore (comments/examples)
      if (id.startsWith("_")) continue

      if (!config.baseURL || !config.endpoint || !config.keyEnv || !config.response) {
        console.warn(`[dsh-model-balance] Skipping invalid provider "${id}": missing required fields`)
        continue
      }

      result[id] = {
        suffix: config.endpoint,
        defaultBaseURL: config.baseURL,
        defaultKeyEnv: config.keyEnv,
        parse: buildParser(config.response),
        ...(config.aliases ? { aliases: config.aliases } : {}),
      }
    }

    return result
  } catch (err) {
    console.error(`[dsh-model-balance] Failed to load config from ${configPath}:`, err)
    return {}
  }
}

/**
 * Load providers from both bundled and user config files.
 * User config takes precedence over bundled config.
 */
export function loadCustomProviders(): Record<string, {
  readonly suffix: string
  readonly defaultBaseURL: string
  readonly defaultKeyEnv: string
  readonly parse: (body: unknown) => BalanceQueryResult
  readonly aliases?: readonly string[]
}> {
  if (cachedCustomStrategies !== null) return cachedCustomStrategies

  // 1. Load bundled providers.json
  const bundled = parseConfigFile(getBundledConfigPath())

  // 2. Load user config (overrides bundled)
  const user = parseConfigFile(getUserConfigPath())

  // 3. Merge (user takes precedence)
  cachedCustomStrategies = { ...bundled, ...user }

  return cachedCustomStrategies
}

/**
 * Clear the cached custom strategies (for testing or hot-reload).
 */
export function clearCustomProvidersCache(): void {
  cachedCustomStrategies = null
}
