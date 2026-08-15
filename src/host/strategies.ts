/**
 * Strategy registry: maps a provider ID (or its configured base URL) to the
 * balance/usage endpoint that can be queried with the provider's API key.
 *
 * Built-in entries cover every provider whose billing API has been verified.
 * `matchStrategy` also attempts URL-family matching so that custom provider
 * aliases (e.g. a proxied StepFun endpoint) resolve automatically.
 *
 * To add a new provider:
 *  1. Verify its billing endpoint (must accept Bearer API key auth).
 *  2. Write a parser that normalises the response into a `CurrencyResult`
 *     or `QuotaResult`.
 *  3. Append to `STRATEGIES`.
 */

import type {
  BalanceQueryResult,
  CurrencyResult,
  QuotaDim,
  QuotaResult,
} from "../types.js"
import { loadCustomProviders } from "./custom-providers.js"

// ---------------------------------------------------------------------------
// Provider parser functions
// ---------------------------------------------------------------------------

function parseDeepSeek(body: unknown): CurrencyResult {
  const infos = (body as Record<string, unknown> | null)?.balance_infos
  if (!Array.isArray(infos) || infos.length === 0) {
    throw new Error("unexpected deepseek balance response")
  }
  const entry = (infos as Array<Record<string, unknown>>).find(
    (i) => i?.currency === "CNY"
  ) ?? infos[0]
  const balance = Number((entry as Record<string, unknown>)?.total_balance)
  if (!Number.isFinite(balance)) {
    throw new Error("deepseek balance is not numeric")
  }
  return {
    queryable: true,
    kind: "currency",
    currency: typeof (entry as Record<string, unknown>).currency === "string"
      ? (entry as Record<string, unknown>).currency as string
      : "CNY",
    balance,
    granted: Number((entry as Record<string, unknown>).granted_balance) || 0,
    toppedUp: Number((entry as Record<string, unknown>).topped_up_balance) || 0,
    available: (body as Record<string, unknown>).is_available !== false,
  }
}

function parseStepFun(body: unknown): CurrencyResult {
  const b = body as Record<string, unknown> | null
  const balance = Number(b?.balance)
  if (!Number.isFinite(balance)) {
    throw new Error("unexpected stepfun accounts response")
  }
  return {
    queryable: true,
    kind: "currency",
    currency: "CNY",
    balance,
    cash: Number(b?.total_cash_balance) || 0,
    voucher: Number(b?.total_voucher_balance) || 0,
  }
}

function parseKimiCoding(body: unknown): QuotaResult {
  // Kimi Coding `/v1/usages` returns two windows:
  //   - `usage`:  the 7-day weekly quota (membership tier)
  //   - `limits`: a list of rate limits, the first being the 5-hour window
  //               (window.duration=300, timeUnit=TIME_UNIT_MINUTE)
  const root = (body as Record<string, unknown> | null) ?? {}
  const usage = root.usage as Record<string, unknown> | undefined
  const limit = Number(usage?.limit)
  const used = Number(usage?.used)
  const remaining = Number(usage?.remaining)
  if (!Number.isFinite(limit) || !Number.isFinite(used) || !Number.isFinite(remaining)) {
    throw new Error("unexpected kimi usages response")
  }

  const dims: QuotaDim[] = [
    {
      window: "weekly",
      limit,
      used,
      remaining,
      ...(typeof usage?.resetTime === "string" ? { resetTime: usage.resetTime } : {}),
    },
  ]

  const limits = root.limits
  if (Array.isArray(limits) && limits.length > 0) {
    const detail = (limits[0] as Record<string, unknown> | undefined)?.detail as
      | Record<string, unknown>
      | undefined
    const hLimit = Number(detail?.limit)
    const hUsed = Number(detail?.used)
    const hRemaining = Number(detail?.remaining)
    if (Number.isFinite(hLimit) && Number.isFinite(hUsed) && Number.isFinite(hRemaining)) {
      dims.push({
        window: "hourly",
        limit: hLimit,
        used: hUsed,
        remaining: hRemaining,
        ...(typeof detail?.resetTime === "string" ? { resetTime: detail.resetTime } : {}),
      })
    }
  }

  return {
    queryable: true,
    kind: "quota",
    unit: "requests",
    limit,
    used,
    remaining,
    ...(typeof usage?.resetTime === "string" ? { resetTime: usage.resetTime } : {}),
    dims,
  }
}

function parseOpenRouter(body: unknown): CurrencyResult {
  const data = (body as Record<string, unknown> | null)?.data as
    | Record<string, unknown>
    | undefined
  if (!data) throw new Error("unexpected openrouter auth/key response")
  // OpenRouter returns limit and usage in cents
  const limitCents = Number(data.limit)
  const usageCents = Number(data.usage)
  if (!Number.isFinite(limitCents)) throw new Error("openrouter limit is not numeric")
  const balance = limitCents > 0 ? (limitCents - usageCents) / 100 : 0
  return {
    queryable: true,
    kind: "currency",
    currency: "USD",
    balance,
  }
}

function parseMiniMax(body: unknown): QuotaResult {
  const b = body as Record<string, unknown> | null
  const remaining = Number(b?.data ?? b?.remaining)
  const total = Number(b?.total ?? b?.limit)
  if (!Number.isFinite(remaining)) throw new Error("unexpected minimax remains response")
  return {
    queryable: true,
    kind: "quota",
    unit: "requests",
    limit: Number.isFinite(total) ? total : 0,
    used: Number.isFinite(total) && Number.isFinite(remaining) ? total - remaining : 0,
    remaining,
  }
}

function parseXai(body: unknown): CurrencyResult {
  const b = body as Record<string, unknown> | null
  const balance = Number(b?.balance ?? b?.total_granted)
  if (!Number.isFinite(balance)) throw new Error("unexpected xai credit response")
  return {
    queryable: true,
    kind: "currency",
    currency: "USD",
    balance,
  }
}

// ---------------------------------------------------------------------------
// Strategy type and registry
// ---------------------------------------------------------------------------

interface Strategy {
  readonly suffix: string
  readonly defaultBaseURL: string
  readonly defaultKeyEnv: string
  readonly parse: (body: unknown) => BalanceQueryResult
  /** Additional known provider IDs that share this strategy. */
  readonly aliases?: readonly string[]
}

/**
 * Canonical strategy registry. Keys are the "primary" provider IDs.
 *
 * `matchStrategy` resolves by:
 *  1. Exact ID match (case-insensitive against all known IDs incl. aliases).
 *  2. Base-URL family match (e.g. any `*.stepfun.com/v1` → stepfun).
 */
export const STRATEGIES: Record<string, Strategy> = {
  deepseek: {
    suffix: "/user/balance",
    defaultBaseURL: "https://api.deepseek.com",
    defaultKeyEnv: "DEEPSEEK_API_KEY",
    parse: parseDeepSeek,
    aliases: ["deepseek-official"],
  },
  stepfun: {
    suffix: "/accounts",
    defaultBaseURL: "https://api.stepfun.com/v1",
    defaultKeyEnv: "STEPFUN_API_KEY",
    parse: parseStepFun,
  },
  "kimi-coding": {
    suffix: "/v1/usages",
    defaultBaseURL: "https://api.kimi.com/coding",
    defaultKeyEnv: "KIMI_API_KEY",
    parse: parseKimiCoding,
  },
  openrouter: {
    suffix: "/api/v1/auth/key",
    defaultBaseURL: "https://openrouter.ai",
    defaultKeyEnv: "OPENROUTER_API_KEY",
    parse: parseOpenRouter,
  },
  minimax: {
    suffix: "/v1/token_plan/remains",
    defaultBaseURL: "https://api.minimax.chat",
    defaultKeyEnv: "MINIMAX_API_KEY",
    parse: parseMiniMax,
  },
  xai: {
    suffix: "/v1/dashboard/billing/credit_grants",
    defaultBaseURL: "https://api.x.ai",
    defaultKeyEnv: "XAI_API_KEY",
    parse: parseXai,
    aliases: ["xai", "grok"],
  },
}

// Pre-computed lookup: every known ID → canonical key
const KNOWN_IDS = new Map<string, string>()
for (const [canonical, strategy] of Object.entries(STRATEGIES)) {
  KNOWN_IDS.set(canonical.toLowerCase(), canonical)
  for (const alias of strategy.aliases ?? []) {
    KNOWN_IDS.set(alias.toLowerCase(), canonical)
  }
}

// URL family matchers: regex → canonical strategy key
const URL_MATCHERS: Array<[RegExp, string]> = [
  [/api\.deepseek\.com/i, "deepseek"],
  [/api\.stepfun\.com/i, "stepfun"],
  [/api\.kimi\.com/i, "kimi-coding"],
  [/openrouter\.ai/i, "openrouter"],
  [/api\.minimax\.chat/i, "minimax"],
  [/api\.x\.ai/i, "xai"],
  [/platform\.stepfun\.com/i, "stepfun"],
  [/coding\.dashscope/i, "qwen-coding-plan"],
  [/maas\.aliyuncs\.com/i, "qwen-token-plan"],
  [/xiaomimimo\.com/i, "xiaomi"],
]

export interface ResolvedStrategy {
  readonly url: string
  readonly keyEnv: string
  readonly canonical: string
  readonly parse: (body: unknown) => BalanceQueryResult
}

/**
 * Get all strategies (built-in + custom).
 * Built-in strategies take precedence over config file entries.
 */
function getAllStrategies(): Record<string, Strategy> {
  const custom = loadCustomProviders()
  // Custom first, then built-in overrides (so built-in wins on conflicts)
  return { ...custom, ...STRATEGIES }
}

/**
 * Build a lookup map for all known IDs (including custom providers).
 */
function buildKnownIds(): Map<string, string> {
  const map = new Map<string, string>()
  const all = getAllStrategies()
  for (const [canonical, strategy] of Object.entries(all)) {
    map.set(canonical.toLowerCase(), canonical)
    for (const alias of strategy.aliases ?? []) {
      map.set(alias.toLowerCase(), canonical)
    }
  }
  return map
}

/**
 * Resolve a provider to its balance query strategy.
 *
 * @param providerId - The provider group ID from the model directory.
 * @param configuredBaseURL - The baseURL from settings (if any).
 * @param configuredKeyEnv  - The apiKeyEnv from settings (if any).
 * @returns The resolved strategy, or `undefined` if no match.
 */
export function matchStrategy(
  providerId: string,
  configuredBaseURL?: string,
  configuredKeyEnv?: string,
): ResolvedStrategy | undefined {
  const allStrategies = getAllStrategies()
  const allKnownIds = buildKnownIds()

  // 1) Exact ID match
  const canonical = allKnownIds.get(providerId.toLowerCase())
  if (canonical !== undefined) {
    const s = allStrategies[canonical]
    if (s) {
      const base = stripSlash(configuredBaseURL ?? s.defaultBaseURL)
      return {
        url: `${base}${s.suffix}`,
        keyEnv: configuredKeyEnv ?? s.defaultKeyEnv,
        canonical,
        parse: s.parse,
      }
    }
  }

  // 2) URL family match (for custom aliases that point to a known endpoint)
  const baseURL = configuredBaseURL
  if (baseURL !== undefined) {
    for (const [pattern, key] of URL_MATCHERS) {
      if (pattern.test(baseURL)) {
        const s = allStrategies[key]
        if (s !== undefined) {
          return {
            url: `${stripSlash(baseURL)}${s.suffix}`,
            keyEnv: configuredKeyEnv ?? s.defaultKeyEnv,
            canonical: key,
            parse: s.parse,
          }
        }
      }
    }
  }

  return undefined
}

function stripSlash(url: string): string {
  return url.replace(/\/+$/, "")
}
