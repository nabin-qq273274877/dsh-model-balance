/**
 * dsh-model-balance client half.
 *
 * Renders a balance pill in the composer's `conversation.input.right` slot
 * (immediately beside the model selector).  Fetches the real account
 * balance from the host route registered by the host half.
 *
 * Refresh triggers:
 *  - mount and every provider switch
 *  - session `running` transitions true → false (turn ended, usage changed)
 *  - periodic poll (every 2 minutes)
 *  - click (bypasses host cache)
 */

import * as React from "react"
import { jsx } from "react/jsx-runtime"
import type { BalanceQueryResult } from "../types.js"

// ---------------------------------------------------------------------------
// Icons (react/jsx-runtime elements)
// ---------------------------------------------------------------------------

function CoinIcon() {
  return jsx(
    "svg",
    { viewBox: "0 0 14 14", width: 12, height: 12, "aria-hidden": true },
    jsx("circle", { cx: 7, cy: 7, r: 6.1, fill: "none", stroke: "currentColor", strokeWidth: 1.2 }),
    jsx("path", {
      d: "M4.7 4.1 7 6.9l2.3-2.8M7 6.9v3.4M5.3 8h3.4M5.3 9.7h3.4",
      fill: "none", stroke: "currentColor", strokeWidth: 1.1,
      strokeLinecap: "round", strokeLinejoin: "round",
    }),
  )
}

function GaugeIcon() {
  return jsx(
    "svg",
    { viewBox: "0 0 14 14", width: 12, height: 12, "aria-hidden": true },
    jsx("path", {
      d: "M2.2 10.2a4.8 4.8 0 1 1 9.6 0",
      fill: "none", stroke: "currentColor", strokeWidth: 1.2, strokeLinecap: "round",
    }),
    jsx("path", {
      d: "M7 10.2 9.4 7.2",
      fill: "none", stroke: "currentColor", strokeWidth: 1.2, strokeLinecap: "round",
    }),
  )
}

function WarnIcon() {
  return jsx(
    "svg",
    { viewBox: "0 0 14 14", width: 12, height: 12, "aria-hidden": true },
    jsx("path", {
      d: "M7 2 12.6 11.6H1.4L7 2Z",
      fill: "none", stroke: "currentColor", strokeWidth: 1.2, strokeLinejoin: "round",
    }),
    jsx("path", { d: "M7 5.8v2.6", stroke: "currentColor", strokeWidth: 1.2, strokeLinecap: "round" }),
    jsx("circle", { cx: 7, cy: 10, r: 0.7, fill: "currentColor" }),
  )
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function symbolOf(currency: string): string {
  if (currency === "CNY") return "¥"
  if (currency === "USD") return "$"
  return `${currency} `
}

function formatReset(resetTime: string): string {
  const date = new Date(resetTime)
  if (Number.isNaN(date.getTime())) return resetTime
  return date.toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ---------------------------------------------------------------------------
// DSH CSS injection
// ---------------------------------------------------------------------------

const CSS = `.dshMb_root{height:28px;cursor:pointer;color:var(--dsw-alias-label-secondary);user-select:none;white-space:nowrap;align-items:center;gap:4px;padding:0 8px;font-size:13px;font-weight:500;line-height:20px;font-variant-numeric:tabular-nums;display:flex;flex:none;border:none;background:0 0;border-radius:24px}.dshMb_root:hover{background:var(--dsw-alias-interactive-bg-hover)}.dshMb_icon{display:flex;flex:none}.dshMb_root[data-tone=dim]{color:var(--dsw-alias-label-dimmed)}.dshMb_root[data-tone=warn]{color:var(--dsw-alias-state-warn-label)}.dshMb_root[data-tone=error]{color:var(--dsw-alias-state-error-primary)}.dshMb_root[data-tone=dim] .dshMb_icon{color:var(--dsw-alias-label-dimmed)}.dshMb_root:not([data-tone]) .dshMb_icon{color:var(--dsw-alias-label-caption)}`

const TAG_ID = "dsh-model-balance/BalancePill.module.css"

if (
  typeof document !== "undefined" &&
  document.querySelector(`style[data-plugin-css=${JSON.stringify(TAG_ID)}]`) === null
) {
  const tag = document.createElement("style")
  tag.dataset.plugin = "dsh-model-balance"
  tag.dataset.pluginCss = TAG_ID
  tag.textContent = CSS
  document.head.appendChild(tag)
}

const CLS = {
  root: "dshMb_root",
  icon: "dshMb_icon",
}

// ---------------------------------------------------------------------------
// Balance pill component
// ---------------------------------------------------------------------------

const QUERY_PATH = "/model-balance/query"
const POLL_MS = 120_000

interface QueryState {
  status: "idle" | "loading" | "ready" | "error"
  provider?: string
  value?: BalanceQueryResult
  message?: string
}

/**
 * Render a `<button>` that displays the real balance of the current model's
 * provider account, or "暂不支持" / "查询失败" when appropriate.
 *
 * Props come from the slot system:
 *  - `directory`: SnapshotStore<ModelDirectoryState> (from inject)
 *  - `session`: ConversationSnapshot (owner share — has `running`)
 *  - `t`: locale translator (slot locale)
 */
function BalancePill(props: any) {
  const { directory, session, t, load } = props
  const { useSyncExternalStore, useState, useRef, useEffect, useCallback } = React

  const state = useSyncExternalStore(
    (fn: () => void) => directory.subscribe(fn),
    () => directory.getSnapshot(),
  )
  const running = session?.running ?? false
  const current = state.current
  const provider: string | null = current === null ? null : current.provider

  // Load the directory on mount so `current` is populated (host does not push it)
  useEffect(() => {
    load?.()
  }, [load])
  const groupName =
    provider === null
      ? ""
      : (state.groups.find((g: any) => g.id === provider)?.name ?? provider)

  const [query, setQuery] = useState<QueryState>({ status: "idle" })
  const seqRef = useRef(0)

  const runQuery = useCallback(
    (prov: string, bypass: boolean) => {
      const seq = ++seqRef.current
      setQuery((prev: QueryState) =>
        prev.status === "idle" || prev.provider !== prov
          ? { status: "loading", provider: prov }
          : prev,
      )
      fetch(
        `${QUERY_PATH}?provider=${encodeURIComponent(prov)}${bypass ? "&refresh=1" : ""}`,
        { headers: { accept: "application/json" } },
      )
        .then((r) =>
          r.json().catch(() => ({
            ok: false,
            error: { code: "bad-response", message: `HTTP ${r.status}` },
          })),
        )
        .then((body: any) => {
          if (seq !== seqRef.current) return
          if (body !== null && typeof body === "object" && body.ok === true) {
            setQuery({ status: "ready", provider: prov, value: body.value })
          } else {
            setQuery({
              status: "error",
              provider: prov,
              message: body?.error?.message ?? String(body),
            })
          }
        })
        .catch((err: unknown) => {
          if (seq !== seqRef.current) return
          setQuery({
            status: "error",
            provider: prov,
            message: err instanceof Error ? err.message : String(err),
          })
        })
    },
    [],
  )

  // On provider change → query
  useEffect(() => {
    if (provider === null) {
      seqRef.current += 1
      setQuery({ status: "idle" })
      return
    }
    runQuery(provider, false)
  }, [provider, runQuery])

  // On turn end (running true→false) → force refresh
  const prevRunningRef = useRef(running)
  useEffect(() => {
    const was = prevRunningRef.current
    prevRunningRef.current = running
    if (was && !running && provider !== null) runQuery(provider, true)
  }, [running, provider, runQuery])

  // Periodic poll
  useEffect(() => {
    if (provider === null) return
    const timer = setInterval(() => runQuery(provider, false), POLL_MS)
    return () => clearInterval(timer)
  }, [provider, runQuery])

  if (provider === null) return null

  // --- Idle / loading ---
  if (query.status === "idle" || query.status === "loading") {
    return jsx(
      "div",
      {
        className: CLS.root,
        "data-tone": "dim",
        title: t("tooltip.loading", { provider: groupName }),
      },
      jsx("span", { className: CLS.icon }, jsx(CoinIcon, {})),
      jsx("span", {}, t("pill.querying")),
    )
  }

  // --- Error ---
  if (query.status === "error") {
    return jsx(
      "button",
      {
        type: "button",
        className: CLS.root,
        "data-tone": "error",
        title: t("tooltip.error", { message: query.message }),
        "aria-label": t("aria.error", { provider: groupName, message: query.message }),
        onClick: () => runQuery(provider, true),
      },
      jsx("span", { className: CLS.icon }, jsx(WarnIcon, {})),
      jsx("span", {}, t("pill.error")),
    )
  }

  const value = query.value!

  // --- Unqueryable ---
  if (value.queryable === false) {
    return jsx(
      "button",
      {
        type: "button",
        className: CLS.root,
        "data-tone": "error",
        title: t("tooltip.unqueryable", { provider: groupName }),
        "aria-label": t("aria.unqueryable", { provider: groupName }),
        onClick: () => runQuery(provider, true),
      },
      jsx("span", { className: CLS.icon }, jsx(WarnIcon, {})),
      jsx("span", {}, t("pill.unqueryable")),
    )
  }

  // --- Quota ---
  if (value.kind === "quota") {
    const tone =
      value.remaining <= 0
        ? "error"
        : value.limit > 0 && value.remaining <= value.limit * 0.1
          ? "warn"
          : undefined
    const quotaText = t("quota.value", {
      remaining: value.remaining,
      limit: value.limit,
    })
    return jsx(
      "button",
      {
        type: "button",
        className: CLS.root,
        ...(tone !== undefined ? { "data-tone": tone } : {}),
        title: t("tooltip.quota", {
          provider: groupName,
          remaining: value.remaining,
          limit: value.limit,
          reset: value.resetTime !== undefined ? formatReset(value.resetTime) : "?",
        }),
        "aria-label": t("aria.quota", {
          provider: groupName,
          remaining: value.remaining,
          limit: value.limit,
        }),
        onClick: () => runQuery(provider, true),
      },
      jsx("span", { className: CLS.icon }, jsx(GaugeIcon, {})),
      jsx("span", {}, quotaText),
    )
  }

  // --- Currency ---
  const symbol = symbolOf(value.currency)
  const balanceText = `${symbol} ${value.balance.toFixed(2)}`
  const tone =
    value.balance <= 0.005 ? "error" : value.balance < 20 ? "warn" : undefined

  return jsx(
    "button",
    {
      type: "button",
      className: CLS.root,
      ...(tone !== undefined ? { "data-tone": tone } : {}),
      title: t("tooltip.currency", {
        provider: groupName,
        balance: value.balance.toFixed(2),
      }),
      "aria-label": t("aria.currency", {
        provider: groupName,
        balance: value.balance.toFixed(2),
      }),
      onClick: () => runQuery(provider, true),
    },
    jsx("span", { className: CLS.icon }, jsx(CoinIcon, {})),
    jsx("span", {}, balanceText),
  )
}

// ---------------------------------------------------------------------------
// Locales
// ---------------------------------------------------------------------------

const zh: Record<string, string> = {
  "pill.querying": "查询中…",
  "pill.error": "查询失败",
  "pill.unqueryable": "暂不支持",
  "quota.value": "{remaining}/{limit} 次",
  "tooltip.loading": "正在查询 {provider} 余额…",
  "tooltip.currency": "{provider} 账户余额 ¥{balance}（点击刷新）",
  "tooltip.quota":
    "{provider} 配额剩余 {remaining}/{limit} 次 · 重置：{reset}（点击刷新）",
  "tooltip.unqueryable": "{provider} 暂不支持余额查询（点击重试）",
  "tooltip.error": "余额查询失败：{message}（点击重试）",
  "aria.currency": "{provider} 账户余额 {balance} 元",
  "aria.quota": "{provider} 配额剩余 {remaining} 次，共 {limit} 次",
  "aria.unqueryable": "{provider} 暂不支持余额查询",
  "aria.error": "{provider} 余额查询失败：{message}",
}

const en: Record<string, string> = {
  "pill.querying": "Checking…",
  "pill.error": "Query failed",
  "pill.unqueryable": "Not supported",
  "quota.value": "{remaining}/{limit} req",
  "tooltip.loading": "Querying {provider} balance…",
  "tooltip.currency": "{provider} account balance ¥{balance} (click to refresh)",
  "tooltip.quota":
    "{provider} quota {remaining}/{limit} requests left · resets {reset} (click to refresh)",
  "tooltip.unqueryable": "{provider} balance query is not supported (click to retry)",
  "tooltip.error": "Balance query failed: {message} (click to retry)",
  "aria.currency": "{provider} account balance: {balance}",
  "aria.quota": "{provider} quota: {remaining} of {limit} requests left",
  "aria.unqueryable": "{provider} balance query is not supported",
  "aria.error": "{provider} balance query failed: {message}",
}

// ---------------------------------------------------------------------------
// Plugin registration
// ---------------------------------------------------------------------------

const NS = "model-balance"

export const inject = ["slots", "locale", "modelDirectories"] as const

export function apply(ctx: any): void {
  ctx.effect(
    () => ctx.locale.register(NS, { zh, en }),
    "model-balance: dictionaries",
  )

  ctx.inject(["slots", "modelDirectories"], (scope: any) => {
    const models = scope.modelDirectories

    scope.slots.inject("conversation.input.right", () =>
      scope.slots.register(
        {
          name: "conversation.input.right",
          locale: NS,
          inject: (sessionId: string) => {
            const directory = models.directoryFor(sessionId)
            return {
              directory: directory.store,
              load: () => {
                directory.load().catch(() => {})
              },
            }
          },
        },
        BalancePill,
      ),
    )
  })
}

export { BalancePill }
