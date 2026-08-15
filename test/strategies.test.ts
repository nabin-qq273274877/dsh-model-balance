import { describe, it, expect } from "vitest"
import { matchStrategy, STRATEGIES } from "../src/host/strategies.js"
import type { CurrencyResult, QuotaResult } from "../src/types.js"

describe("STRATEGIES", () => {
  it("contains expected providers", () => {
    const ids = Object.keys(STRATEGIES)
    expect(ids).toContain("deepseek")
    expect(ids).toContain("stepfun")
    expect(ids).toContain("kimi-coding")
    expect(ids).toContain("openrouter")
    expect(ids).toContain("minimax")
    expect(ids).toContain("xai")
  })
})

describe("matchStrategy", () => {
  it("matches deepseek by primary ID", () => {
    const s = matchStrategy("deepseek")
    expect(s).toBeDefined()
    expect(s!.canonical).toBe("deepseek")
    expect(s!.url).toBe("https://api.deepseek.com/user/balance")
    expect(s!.keyEnv).toBe("DEEPSEEK_API_KEY")
  })

  it("matches deepseek-official (alias)", () => {
    const s = matchStrategy("deepseek-official")
    expect(s).toBeDefined()
    expect(s!.canonical).toBe("deepseek")
    expect(s!.url).toBe("https://api.deepseek.com/user/balance")
  })

  it("matches stepfun by ID", () => {
    const s = matchStrategy("stepfun")
    expect(s).toBeDefined()
    expect(s!.canonical).toBe("stepfun")
    expect(s!.url).toBe("https://api.stepfun.com/v1/accounts")
  })

  it("matches kimi-coding by ID", () => {
    const s = matchStrategy("kimi-coding")
    expect(s).toBeDefined()
    expect(s!.canonical).toBe("kimi-coding")
    expect(s!.url).toBe("https://api.kimi.com/coding/v1/usages")
  })

  it("matches openrouter by ID", () => {
    const s = matchStrategy("openrouter")
    expect(s).toBeDefined()
    expect(s!.canonical).toBe("openrouter")
    expect(s!.url).toBe("https://openrouter.ai/api/v1/auth/key")
  })

  it("returns undefined for unknown provider", () => {
    expect(matchStrategy("qwen-token-plan-cn")).toBeUndefined()
    expect(matchStrategy("xiaomi")).toBeUndefined()
    expect(matchStrategy("totally-unknown")).toBeUndefined()
  })

  it("uses configured baseURL override", () => {
    const s = matchStrategy(
      "deepseek",
      "https://custom-proxy.example.com/v1",
    )
    expect(s).toBeDefined()
    expect(s!.url).toBe("https://custom-proxy.example.com/v1/user/balance")
  })

  it("uses configured keyEnv override", () => {
    const s = matchStrategy("deepseek", undefined, "CUSTOM_KEY_ENV")
    expect(s).toBeDefined()
    expect(s!.keyEnv).toBe("CUSTOM_KEY_ENV")
  })

  it("matches by URL family (stepfun proxy)", () => {
    const s = matchStrategy(
      "my-stepfun-proxy",
      "https://proxy.example.com/v1",
    )
    // Should NOT match because the URL doesn't contain stepfun
    expect(s).toBeUndefined()

    const s2 = matchStrategy(
      "my-stepfun-proxy",
      "https://api.stepfun.com/v1",
    )
    expect(s2).toBeDefined()
    expect(s2!.canonical).toBe("stepfun")
  })

  it("matches by URL family (openrouter)", () => {
    const s = matchStrategy(
      "custom-openrouter",
      "https://openrouter.ai/api/v1",
    )
    expect(s).toBeDefined()
    expect(s!.canonical).toBe("openrouter")
  })
})

// ---------------------------------------------------------------------------
// Parser tests (inline, since parsers are internal to strategies)
// ---------------------------------------------------------------------------

describe("DeepSeek parser", () => {
  it("parses normal response", () => {
    const s = matchStrategy("deepseek")!
    const result = s.parse({
      is_available: true,
      balance_infos: [
        { currency: "CNY", total_balance: "44.17", granted_balance: "0.00", topped_up_balance: "44.17" },
      ],
    }) as CurrencyResult
    expect(result.queryable).toBe(true)
    expect(result.kind).toBe("currency")
    expect(result.currency).toBe("CNY")
    expect(result.balance).toBe(44.17)
    expect(result.available).toBe(true)
  })

  it("picks CNY over other currencies", () => {
    const s = matchStrategy("deepseek")!
    const result = s.parse({
      is_available: true,
      balance_infos: [
        { currency: "USD", total_balance: "10.00" },
        { currency: "CNY", total_balance: "50.00" },
      ],
    }) as CurrencyResult
    expect(result.currency).toBe("CNY")
    expect(result.balance).toBe(50)
  })

  it("throws on invalid response", () => {
    const s = matchStrategy("deepseek")!
    expect(() => s.parse({ balance_infos: [] })).toThrow()
    expect(() => s.parse({})).toThrow()
  })
})

describe("StepFun parser", () => {
  it("parses normal response", () => {
    const s = matchStrategy("stepfun")!
    const result = s.parse({
      object: "account",
      type: "prepaid",
      balance: 14.81,
      total_cash_balance: 50.0,
      total_voucher_balance: 0.0,
    }) as CurrencyResult
    expect(result.queryable).toBe(true)
    expect(result.kind).toBe("currency")
    expect(result.currency).toBe("CNY")
    expect(result.balance).toBe(14.81)
  })
})

describe("Kimi Coding parser", () => {
  it("parses normal response", () => {
    const s = matchStrategy("kimi-coding")!
    const result = s.parse({
      usage: {
        limit: "100",
        used: "22",
        remaining: "78",
        resetTime: "2026-08-21T02:19:08Z",
      },
    }) as QuotaResult
    expect(result.queryable).toBe(true)
    expect(result.kind).toBe("quota")
    expect(result.limit).toBe(100)
    expect(result.used).toBe(22)
    expect(result.remaining).toBe(78)
    expect(result.resetTime).toBe("2026-08-21T02:19:08Z")
  })
})

describe("OpenRouter parser", () => {
  it("parses credit response", () => {
    const s = matchStrategy("openrouter")!
    const result = s.parse({
      data: { limit: 5000, usage: 1234 },
    }) as CurrencyResult
    expect(result.queryable).toBe(true)
    expect(result.kind).toBe("currency")
    expect(result.currency).toBe("USD")
    expect(result.balance).toBeCloseTo(37.66, 1)
  })
})
