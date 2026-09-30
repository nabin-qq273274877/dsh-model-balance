/**
 * dsh-model-balance host half.
 *
 * Registers `GET /model-balance/query?provider=<id>[&refresh=1]` on the DSH
 * web server.  Resolves the provider's credential from the host credential
 * store and queries its official balance/usage endpoint.
 *
 * Account providers (e.g. `deepseek-account`, the route behind an official
 * sign-in) hold no API key: their balance comes from the Host account service
 * (`ctx.get("deepseekAccount").getBalance`), which reads the DeepSeek Platform
 * wallet API with the stored sign-in grant.
 *
 * Providers without a known API-key-level billing endpoint answer
 * `{queryable:false}` so the client pill can show the appropriate state.
 *
 * Results are cached briefly (60 s success / 15 s error) per provider;
 * `refresh=1` bypasses the cache read (manual retry and end-of-turn refresh).
 */

import type { BalanceQueryResult, BalanceResponse, CurrencyResult } from "../types.js"
import { matchStrategy, matchLoginRequired, matchAccountProvider } from "./strategies.js"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Cordis plugin name used by loader diagnostics. */
export const name = "model-balance"

/** Services required by the host half. */
export const inject = ["webServer", "settings", "credentials"] as const

/** Route path the client pill queries. */
const ROUTE_PATH = "/model-balance/query"

/** How long a successful provider answer is reused (ms). */
const OK_TTL_MS = 60_000
/** How long a failed provider answer is reused (ms). */
const ERROR_TTL_MS = 15_000
/** Provider request timeout (ms). */
const PROVIDER_TIMEOUT_MS = 15_000

/**
 * Console URL offered when an account provider has no stored sign-in grant.
 * The pill turns it into a "click to sign in" button.
 */
const ACCOUNT_LOGIN_URL = "https://platform.deepseek.com/"

/**
 * Client identity sent with an account balance query.  The Host only needs a
 * well-formed identity to build Platform request headers; the account UI sends
 * its own build version here.
 */
const ACCOUNT_CLIENT_VERSION = "1.0.0"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseQuery(reqUrl: string): {
  provider: string | null
  refresh: boolean
} {
  const url = new URL(reqUrl, "http://localhost")
  const provider = url.searchParams.get("provider")
  return {
    provider: provider === null || provider === "" ? null : provider,
    refresh: url.searchParams.get("refresh") === "1",
  }
}

function sendJson(res: any, status: number, body: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  })
  res.end(JSON.stringify(body))
}

/** Read a settings namespace defensively (never throws). */
function readSection(settings: any, ns: string): Record<string, unknown> | undefined {
  try {
    const value = settings.get(ns)
    if (value === undefined || value === null || typeof value !== "object") return undefined
    return value as Record<string, unknown>
  } catch {
    return undefined
  }
}

/** Fetch one JSON document with bearer auth and a hard timeout. */
async function fetchProviderJson(
  url: string,
  apiKey: string,
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${apiKey}`,
      accept: "application/json",
    },
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  })
  const text = await response.text()
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    body = undefined
  }
  return { status: response.status, body }
}

/**
 * Reduce the requesting UI's `Accept-Language` to the Platform wire locale.
 * Only the language of Platform-authored messages depends on it.
 */
function wireLocale(req: any): string {
  const header = req?.headers?.["accept-language"]
  return typeof header === "string" && header.trim().toLowerCase().startsWith("zh")
    ? "zh_CN"
    : "en_US"
}

/** Sum one wallet list (`[{ currency, balance }]`) into an amount. */
function walletTotal(wallets: unknown): number {
  if (!Array.isArray(wallets)) return 0
  let total = 0
  for (const wallet of wallets) {
    const value = Number((wallet as Record<string, unknown> | null)?.balance)
    if (Number.isFinite(value)) total += value
  }
  return total
}

/** Read the first currency a wallet list declares. */
function walletCurrency(wallets: unknown): string | undefined {
  if (!Array.isArray(wallets)) return undefined
  for (const wallet of wallets) {
    const currency = (wallet as Record<string, unknown> | null)?.currency
    if (typeof currency === "string" && currency !== "") return currency
  }
  return undefined
}

/** Round an amount to the two decimals the pill displays. */
function round2(value: number): number {
  return Number(value.toFixed(2))
}

/**
 * Project the Host account service's balance outcome onto a currency result.
 *
 * The Platform wallet API splits a recharge wallet (`value`) from granted
 * bonuses (`bonusWallets`); the pill shows their sum, and the detail fields
 * keep both parts inspectable.
 */
export function parseAccountBalance(outcome: any): CurrencyResult {
  const toppedUp = round2(walletTotal(outcome?.value))
  const granted = round2(walletTotal(outcome?.bonusWallets))
  return {
    queryable: true,
    kind: "currency",
    currency:
      walletCurrency(outcome?.value) ?? walletCurrency(outcome?.bonusWallets) ?? "CNY",
    balance: round2(toppedUp + granted),
    toppedUp,
    granted,
  }
}

// ---------------------------------------------------------------------------
// Per-provider cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  at: number
  ok: boolean
  envelope: BalanceResponse
}

// ---------------------------------------------------------------------------
// Plugin apply
// ---------------------------------------------------------------------------

/**
 * Host plugin body: mount the query route with its per-provider cache.
 */
export function apply(ctx: any): () => void {
  const cache = new Map<string, CacheEntry>()

  async function queryAccountBalance(
    providerId: string,
    locale: string,
  ): Promise<BalanceQueryResult> {
    const account = ctx.get?.("deepseekAccount")
    // No account implementation mounted (e.g. a web-only composition that
    // never signs in): nothing this plugin can read.
    if (account === undefined || typeof account.getBalance !== "function") {
      return { queryable: false as const, reason: "no-balance-api" as const, provider: providerId }
    }

    const outcome = await account.getBalance({
      version: ACCOUNT_CLIENT_VERSION,
      locale,
      timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
    })

    // null: no stored grant, or the grant was rejected and removed.
    if (outcome === null || outcome === undefined) {
      return {
        queryable: false as const,
        reason: "login-required" as const,
        provider: providerId,
        loginUrl: ACCOUNT_LOGIN_URL,
      }
    }

    if (outcome.status !== "ready") {
      throw new Error("account balance query failed")
    }

    return parseAccountBalance(outcome)
  }

  async function queryProvider(
    providerId: string,
    locale: string,
  ): Promise<BalanceQueryResult> {
    // Account providers authenticate with a Host-managed sign-in grant instead
    // of an API key, so they have no key-based billing endpoint to call.
    if (matchAccountProvider(providerId) !== undefined) {
      return queryAccountBalance(providerId, locale)
    }

    // Read the provider's settings profile
    const piAi = readSection(ctx.settings, "llm-pi-ai")
    const profile = (piAi?.providers as Record<string, any> | undefined)?.[providerId]
    const configuredBaseURL =
      typeof profile?.baseURL === "string" && profile.baseURL !== ""
        ? profile.baseURL
        : undefined
    let configuredKeyEnv =
      typeof profile?.apiKeyEnv === "string" && profile.apiKeyEnv !== ""
        ? profile.apiKeyEnv
        : undefined

    // For deepseek-official, also check the llm-deepseek namespace
    if (configuredKeyEnv === undefined) {
      const deepseek = readSection(ctx.settings, "llm-deepseek")
      if (typeof deepseek?.apiKeyEnv === "string" && deepseek.apiKeyEnv !== "") {
        configuredKeyEnv = deepseek.apiKeyEnv
      }
    }

    const strategy = matchStrategy(providerId, configuredBaseURL, configuredKeyEnv)
    if (strategy === undefined) {
      const loginUrl = matchLoginRequired(providerId, configuredBaseURL)
      if (loginUrl !== undefined) {
        return {
          queryable: false as const,
          reason: "login-required" as const,
          provider: providerId,
          loginUrl,
        }
      }
      return { queryable: false as const, reason: "no-balance-api" as const, provider: providerId }
    }

    const credential = await ctx.credentials.resolve(strategy.keyEnv)
    if (credential === undefined || !credential.value) {
      throw new Error(`credential "${strategy.keyEnv}" is not configured`)
    }

    const { status, body } = await fetchProviderJson(strategy.url, credential.value)
    if (status !== 200) {
      const detail =
        (body as any)?.error?.message ?? (body as any)?.message ?? ""
      throw new Error(
        `provider answered HTTP ${status}${detail === "" ? "" : `: ${detail}`}`,
      )
    }

    return strategy.parse(body)
  }

  const handler = async (req: any, res: any): Promise<void> => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, {
          ok: false,
          error: { code: "method-not-allowed", message: "GET only" },
        })
        return
      }

      const { provider, refresh } = parseQuery(req.url ?? "/")
      if (provider === null) {
        sendJson(res, 400, {
          ok: false,
          error: { code: "bad-request", message: "missing provider" },
        })
        return
      }

      // Cache check
      const cached = cache.get(provider)
      if (
        !refresh &&
        cached !== undefined &&
        Date.now() - cached.at < (cached.ok ? OK_TTL_MS : ERROR_TTL_MS)
      ) {
        sendJson(res, 200, cached.envelope)
        return
      }

      let envelope: BalanceResponse
      try {
        const value = await queryProvider(provider, wireLocale(req))
        envelope = { ok: true, value }
      } catch (error: unknown) {
        envelope = {
          ok: false,
          error: {
            code: "provider-query-failed",
            message: error instanceof Error ? error.message : String(error),
          },
        }
      }

      cache.set(provider, {
        at: Date.now(),
        ok: (envelope as any).ok === true,
        envelope,
      })

      sendJson(res, 200, envelope)
    } catch (error: unknown) {
      try {
        sendJson(res, 500, {
          ok: false,
          error: {
            code: "internal",
            message: error instanceof Error ? error.message : String(error),
          },
        })
      } catch {
        /* connection already gone */
      }
    }
  }

  const disposeRoute = ctx.webServer.register({
    kind: "exact",
    path: ROUTE_PATH,
    handler,
  })

  return () => {
    disposeRoute()
    cache.clear()
  }
}
