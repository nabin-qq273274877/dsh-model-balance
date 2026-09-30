import { describe, it, expect } from "vitest"
import { apply, parseAccountBalance } from "../src/host/index.js"

// ---------------------------------------------------------------------------
// Host route harness
// ---------------------------------------------------------------------------

interface CtxOptions {
  account?: unknown
  settings?: Record<string, unknown>
}

interface RouteCall {
  readonly status: number
  readonly body: any
}

/** Mount the real plugin body over a minimal host context and expose the route. */
function mount(options: CtxOptions = {}) {
  let handler: any
  const resolvedEnvs: string[] = []
  const ctx: any = {
    settings: { get: (ns: string) => options.settings?.[ns] },
    credentials: {
      resolve: async (ref: string) => {
        resolvedEnvs.push(ref)
        return undefined
      },
    },
    webServer: {
      register: (route: any) => {
        handler = route.handler
        return () => {}
      },
    },
    get: (service: string) =>
      service === "deepseekAccount" ? options.account : undefined,
  }
  const dispose = apply(ctx)

  const call = (url: string, headers: Record<string, string> = {}): Promise<RouteCall> =>
    new Promise((resolve, reject) => {
      const res: any = {
        status: 0,
        writeHead(status: number) {
          this.status = status
        },
        end(chunk: string) {
          try {
            resolve({ status: this.status, body: JSON.parse(chunk) })
          } catch (error) {
            reject(error)
          }
        },
      }
      Promise.resolve(handler({ method: "GET", url, headers }, res)).catch(reject)
    })

  return { call, dispose, resolvedEnvs }
}

const WALLETS = {
  status: "ready",
  value: [{ currency: "CNY", balance: "24.5634178400000000" }],
  bonusWallets: [{ currency: "CNY", balance: "5.5214013200000000" }],
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

describe("parseAccountBalance", () => {
  it("sums the recharge and bonus wallets", () => {
    const result = parseAccountBalance(WALLETS)
    expect(result.kind).toBe("currency")
    expect(result.currency).toBe("CNY")
    expect(result.balance).toBe(30.08)
    expect(result.toppedUp).toBe(24.56)
    expect(result.granted).toBe(5.52)
  })

  it("falls back to the bonus currency when there is no recharge wallet", () => {
    const result = parseAccountBalance({
      status: "ready",
      value: [],
      bonusWallets: [{ currency: "USD", balance: "3.5" }],
    })
    expect(result.currency).toBe("USD")
    expect(result.balance).toBe(3.5)
    expect(result.toppedUp).toBe(0)
    expect(result.granted).toBe(3.5)
  })

  it("tolerates missing wallet lists", () => {
    const result = parseAccountBalance({ status: "ready" })
    expect(result.balance).toBe(0)
    expect(result.currency).toBe("CNY")
  })
})

// ---------------------------------------------------------------------------
// Host route
// ---------------------------------------------------------------------------

describe("account provider route", () => {
  it("answers deepseek-account from the host account service", async () => {
    const seen: any[] = []
    const { call, dispose } = mount({
      account: {
        getBalance: async (client: any) => {
          seen.push(client)
          return WALLETS
        },
      },
    })

    const { status, body } = await call(
      "/model-balance/query?provider=deepseek-account&refresh=1",
      { "accept-language": "zh-CN,zh;q=0.9" },
    )

    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.value).toMatchObject({
      queryable: true,
      kind: "currency",
      currency: "CNY",
      balance: 30.08,
      toppedUp: 24.56,
      granted: 5.52,
    })
    expect(seen).toHaveLength(1)
    expect(seen[0].locale).toBe("zh_CN")
    expect(typeof seen[0].version).toBe("string")
    expect(typeof seen[0].timezoneOffsetSeconds).toBe("number")
    dispose()
  })

  it("reads the account provider behind an adapter prefix", async () => {
    const { call, dispose } = mount({ account: { getBalance: async () => WALLETS } })
    const { body } = await call(
      "/model-balance/query?provider=vision-toolkit-deepseek-account&refresh=1",
    )
    expect(body.ok).toBe(true)
    expect(body.value.balance).toBe(30.08)
    dispose()
  })

  it("asks for a sign-in when no grant is stored", async () => {
    const { call, dispose } = mount({ account: { getBalance: async () => null } })
    const { body } = await call("/model-balance/query?provider=deepseek-account&refresh=1")
    expect(body.ok).toBe(true)
    expect(body.value.queryable).toBe(false)
    expect(body.value.reason).toBe("login-required")
    expect(body.value.loginUrl).toContain("platform.deepseek.com")
    dispose()
  })

  it("reports no-balance-api when no account service is mounted", async () => {
    const { call, dispose } = mount()
    const { body } = await call("/model-balance/query?provider=deepseek-account&refresh=1")
    expect(body.ok).toBe(true)
    expect(body.value.queryable).toBe(false)
    expect(body.value.reason).toBe("no-balance-api")
    dispose()
  })

  it("surfaces a failed platform query as an error", async () => {
    const { call, dispose } = mount({ account: { getBalance: async () => ({ status: "failed" }) } })
    const { body } = await call("/model-balance/query?provider=deepseek-account&refresh=1")
    expect(body.ok).toBe(false)
    expect(body.error.code).toBe("provider-query-failed")
    dispose()
  })

  it("never falls through to the API-key credential path", async () => {
    const { call, dispose, resolvedEnvs } = mount({ account: { getBalance: async () => WALLETS } })
    await call("/model-balance/query?provider=deepseek-account&refresh=1")
    expect(resolvedEnvs).toEqual([])
    dispose()
  })
})
