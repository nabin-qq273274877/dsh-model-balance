/**
 * Shared types for dsh-model-balance host and client.
 */

/** A balance query that returned a monetary amount. */
export interface CurrencyResult {
  readonly queryable: true
  readonly kind: "currency"
  /** ISO 4217 currency code (CNY, USD, …). */
  readonly currency: string
  readonly balance: number
  /** Whether the provider considers the balance usable for new requests. */
  readonly available?: boolean
  readonly granted?: number
  readonly toppedUp?: number
  readonly cash?: number
  readonly voucher?: number
}

/** A single quota window (e.g. Kimi's 5-hour rate limit or 7-day weekly). */
export interface QuotaDim {
  /** Semantic window key, localized by the client: "hourly" | "weekly". */
  readonly window: string
  readonly limit: number
  readonly used: number
  readonly remaining: number
  /** ISO 8601 timestamp at which this window resets. */
  readonly resetTime?: string
}

/** A balance query that returned a request-count quota. */
export interface QuotaResult {
  readonly queryable: true
  readonly kind: "quota"
  readonly unit: "requests"
  readonly limit: number
  readonly used: number
  readonly remaining: number
  /** ISO 8601 timestamp at which the quota resets. */
  readonly resetTime?: string
  /** Multiple windows (e.g. Kimi 5-hour rate + 7-day weekly). */
  readonly dims?: readonly QuotaDim[]
}

/** The provider has no API-level balance endpoint. */
export interface UnqueryableResult {
  readonly queryable: false
  readonly reason: "no-balance-api"
  readonly provider: string
}

/** Every possible host-route answer for one provider. */
export type BalanceQueryResult = CurrencyResult | QuotaResult | UnqueryableResult

/** Standard JSON envelope returned by `GET /model-balance/query`. */
export interface BalanceEnvelope {
  readonly ok: true
  readonly value: BalanceQueryResult
}

export interface BalanceErrorEnvelope {
  readonly ok: false
  readonly error: { readonly code: string; readonly message: string }
}

export type BalanceResponse = BalanceEnvelope | BalanceErrorEnvelope
