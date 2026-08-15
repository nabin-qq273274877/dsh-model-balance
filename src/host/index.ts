/**
 * dsh-model-balance host half.
 *
 * Registers `GET /model-balance/query?provider=<id>[&refresh=1]` on the DSH
 * web server.  Resolves the provider's credential from the host credential
 * store and queries its official balance/usage endpoint.
 *
 * Providers without a known API-key-level billing endpoint answer
 * `{queryable:false}` so the client pill can show the appropriate state.
 *
 * Results are cached briefly (60 s success / 15 s error) per provider;
 * `refresh=1` bypasses the cache read (manual retry and end-of-turn refresh).
 */

import type { BalanceQueryResult, BalanceResponse } from "../types.js"
import { matchStrategy } from "./strategies.js"

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

  async function queryProvider(providerId: string): Promise<BalanceQueryResult> {
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
        const value = await queryProvider(provider)
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
