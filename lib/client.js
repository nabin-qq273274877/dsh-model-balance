window.__ModuleLoader__.load({
	id: "dsh-model-balance",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		"use strict";
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __export = (target, all) => {
		  for (var name in all)
		    __defProp(target, name, { get: all[name], enumerable: true });
		};
		var __copyProps = (to, from, except, desc) => {
		  if (from && typeof from === "object" || typeof from === "function") {
		    for (let key of __getOwnPropNames(from))
		      if (!__hasOwnProp.call(to, key) && key !== except)
		        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
		  }
		  return to;
		};
		var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

		// src/client/index.ts
		var index_exports = {};
		__export(index_exports, {
		  BalancePill: () => BalancePill,
		  apply: () => apply,
		  inject: () => inject
		});
		module.exports = __toCommonJS(index_exports);
		var h = (type, props, ...children) => ({ type, props: props ?? {}, children });
		function CoinIcon() {
		  return h(
		    "svg",
		    { viewBox: "0 0 14 14", width: 12, height: 12, "aria-hidden": true },
		    h("circle", { cx: 7, cy: 7, r: 6.1, fill: "none", stroke: "currentColor", strokeWidth: 1.2 }),
		    h("path", {
		      d: "M4.7 4.1 7 6.9l2.3-2.8M7 6.9v3.4M5.3 8h3.4M5.3 9.7h3.4",
		      fill: "none",
		      stroke: "currentColor",
		      strokeWidth: 1.1,
		      strokeLinecap: "round",
		      strokeLinejoin: "round"
		    })
		  );
		}
		function GaugeIcon() {
		  return h(
		    "svg",
		    { viewBox: "0 0 14 14", width: 12, height: 12, "aria-hidden": true },
		    h("path", {
		      d: "M2.2 10.2a4.8 4.8 0 1 1 9.6 0",
		      fill: "none",
		      stroke: "currentColor",
		      strokeWidth: 1.2,
		      strokeLinecap: "round"
		    }),
		    h("path", {
		      d: "M7 10.2 9.4 7.2",
		      fill: "none",
		      stroke: "currentColor",
		      strokeWidth: 1.2,
		      strokeLinecap: "round"
		    })
		  );
		}
		function WarnIcon() {
		  return h(
		    "svg",
		    { viewBox: "0 0 14 14", width: 12, height: 12, "aria-hidden": true },
		    h("path", {
		      d: "M7 2 12.6 11.6H1.4L7 2Z",
		      fill: "none",
		      stroke: "currentColor",
		      strokeWidth: 1.2,
		      strokeLinejoin: "round"
		    }),
		    h("path", { d: "M7 5.8v2.6", stroke: "currentColor", strokeWidth: 1.2, strokeLinecap: "round" }),
		    h("circle", { cx: 7, cy: 10, r: 0.7, fill: "currentColor" })
		  );
		}
		function symbolOf(currency) {
		  if (currency === "CNY") return "\xA5";
		  if (currency === "USD") return "$";
		  return `${currency} `;
		}
		function formatReset(resetTime) {
		  const date = new Date(resetTime);
		  if (Number.isNaN(date.getTime())) return resetTime;
		  return date.toLocaleString(void 0, {
		    month: "numeric",
		    day: "numeric",
		    hour: "2-digit",
		    minute: "2-digit"
		  });
		}
		var CSS = `.dshMb_root{height:28px;cursor:pointer;color:var(--dsw-alias-label-secondary);user-select:none;white-space:nowrap;align-items:center;gap:4px;padding:0 8px;font-size:13px;font-weight:500;line-height:20px;font-variant-numeric:tabular-nums;display:flex;flex:none;border:none;background:0 0;border-radius:24px}.dshMb_root:hover{background:var(--dsw-alias-interactive-bg-hover)}.dshMb_icon{display:flex;flex:none}.dshMb_root[data-tone=dim]{color:var(--dsw-alias-label-dimmed)}.dshMb_root[data-tone=warn]{color:var(--dsw-alias-state-warn-label)}.dshMb_root[data-tone=error]{color:var(--dsw-alias-state-error-primary)}.dshMb_root[data-tone=dim] .dshMb_icon{color:var(--dsw-alias-label-dimmed)}.dshMb_root:not([data-tone]) .dshMb_icon{color:var(--dsw-alias-label-caption)}`;
		var TAG_ID = "dsh-model-balance/BalancePill.module.css";
		if (typeof document !== "undefined" && document.querySelector(`style[data-plugin-css=${JSON.stringify(TAG_ID)}]`) === null) {
		  const tag = document.createElement("style");
		  tag.dataset.plugin = "dsh-model-balance";
		  tag.dataset.pluginCss = TAG_ID;
		  tag.textContent = CSS;
		  document.head.appendChild(tag);
		}
		var CLS = {
		  root: "dshMb_root",
		  icon: "dshMb_icon"
		};
		var QUERY_PATH = "/model-balance/query";
		var POLL_MS = 12e4;
		function BalancePill(props) {
		  const { directory, useSession, t } = props;
		  const { useSyncExternalStore, useState, useRef, useEffect, useCallback } = (
		    // eslint-disable-next-line @typescript-eslint/no-var-requires
		    globalThis.__dsh_react ?? require("react")
		  );
		  const reactJsx = globalThis.__dsh_jsx ?? (() => null);
		  const state = useSyncExternalStore(
		    (fn) => directory.subscribe(fn),
		    () => directory.getSnapshot()
		  );
		  const running = useSession((s) => s.running) ?? false;
		  const current = state.current;
		  const provider = current === null ? null : current.provider;
		  const groupName = provider === null ? "" : state.groups.find((g) => g.id === provider)?.name ?? provider;
		  const [query, setQuery] = useState({ status: "idle" });
		  const seqRef = useRef(0);
		  const runQuery = useCallback(
		    (prov, bypass) => {
		      const seq = ++seqRef.current;
		      setQuery(
		        (prev) => prev.status === "idle" || prev.provider !== prov ? { status: "loading", provider: prov } : prev
		      );
		      fetch(
		        `${QUERY_PATH}?provider=${encodeURIComponent(prov)}${bypass ? "&refresh=1" : ""}`,
		        { headers: { accept: "application/json" } }
		      ).then(
		        (r) => r.json().catch(() => ({
		          ok: false,
		          error: { code: "bad-response", message: `HTTP ${r.status}` }
		        }))
		      ).then((body) => {
		        if (seq !== seqRef.current) return;
		        if (body !== null && typeof body === "object" && body.ok === true) {
		          setQuery({ status: "ready", provider: prov, value: body.value });
		        } else {
		          setQuery({
		            status: "error",
		            provider: prov,
		            message: body?.error?.message ?? String(body)
		          });
		        }
		      }).catch((err) => {
		        if (seq !== seqRef.current) return;
		        setQuery({
		          status: "error",
		          provider: prov,
		          message: err instanceof Error ? err.message : String(err)
		        });
		      });
		    },
		    []
		  );
		  useEffect(() => {
		    if (provider === null) {
		      seqRef.current += 1;
		      setQuery({ status: "idle" });
		      return;
		    }
		    runQuery(provider, false);
		  }, [provider, runQuery]);
		  const prevRunningRef = useRef(running);
		  useEffect(() => {
		    const was = prevRunningRef.current;
		    prevRunningRef.current = running;
		    if (was && !running && provider !== null) runQuery(provider, true);
		  }, [running, provider, runQuery]);
		  useEffect(() => {
		    if (provider === null) return;
		    const timer = setInterval(() => runQuery(provider, false), POLL_MS);
		    return () => clearInterval(timer);
		  }, [provider, runQuery]);
		  if (provider === null) return null;
		  if (query.status === "idle" || query.status === "loading") {
		    return reactJsx("div", {
		      className: CLS.root,
		      "data-tone": "dim",
		      title: t("tooltip.loading", { provider: groupName }),
		      children: [
		        reactJsx("span", { className: CLS.icon, children: reactJsx(CoinIcon, {}) }),
		        reactJsx("span", { children: t("pill.querying") })
		      ]
		    });
		  }
		  if (query.status === "error") {
		    return reactJsx("button", {
		      type: "button",
		      className: CLS.root,
		      "data-tone": "error",
		      title: t("tooltip.error", { message: query.message }),
		      "aria-label": t("aria.error", { provider: groupName, message: query.message }),
		      onClick: () => runQuery(provider, true),
		      children: [
		        reactJsx("span", { className: CLS.icon, children: reactJsx(WarnIcon, {}) }),
		        reactJsx("span", { children: t("pill.error") })
		      ]
		    });
		  }
		  const value = query.value;
		  if (value.queryable === false) {
		    return reactJsx("button", {
		      type: "button",
		      className: CLS.root,
		      "data-tone": "error",
		      title: t("tooltip.unqueryable", { provider: groupName }),
		      "aria-label": t("aria.unqueryable", { provider: groupName }),
		      onClick: () => runQuery(provider, true),
		      children: [
		        reactJsx("span", { className: CLS.icon, children: reactJsx(WarnIcon, {}) }),
		        reactJsx("span", { children: t("pill.unqueryable") })
		      ]
		    });
		  }
		  if (value.kind === "quota") {
		    const tone2 = value.remaining <= 0 ? "error" : value.limit > 0 && value.remaining <= value.limit * 0.1 ? "warn" : void 0;
		    const quotaText = t("quota.value", {
		      remaining: value.remaining,
		      limit: value.limit
		    });
		    return reactJsx("button", {
		      type: "button",
		      className: CLS.root,
		      ...tone2 !== void 0 ? { "data-tone": tone2 } : {},
		      title: t("tooltip.quota", {
		        provider: groupName,
		        remaining: value.remaining,
		        limit: value.limit,
		        reset: value.resetTime !== void 0 ? formatReset(value.resetTime) : "?"
		      }),
		      "aria-label": t("aria.quota", {
		        provider: groupName,
		        remaining: value.remaining,
		        limit: value.limit
		      }),
		      onClick: () => runQuery(provider, true),
		      children: [
		        reactJsx("span", { className: CLS.icon, children: reactJsx(GaugeIcon, {}) }),
		        reactJsx("span", { children: quotaText })
		      ]
		    });
		  }
		  const symbol = symbolOf(value.currency);
		  const balanceText = `${symbol} ${value.balance.toFixed(2)}`;
		  const tone = value.balance <= 5e-3 ? "error" : value.balance < 20 ? "warn" : void 0;
		  return reactJsx("button", {
		    type: "button",
		    className: CLS.root,
		    ...tone !== void 0 ? { "data-tone": tone } : {},
		    title: t("tooltip.currency", {
		      provider: groupName,
		      balance: value.balance.toFixed(2)
		    }),
		    "aria-label": t("aria.currency", {
		      provider: groupName,
		      balance: value.balance.toFixed(2)
		    }),
		    onClick: () => runQuery(provider, true),
		    children: [
		      reactJsx("span", { className: CLS.icon, children: reactJsx(CoinIcon, {}) }),
		      reactJsx("span", { children: balanceText })
		    ]
		  });
		}
		var zh = {
		  "pill.querying": "\u67E5\u8BE2\u4E2D\u2026",
		  "pill.error": "\u67E5\u8BE2\u5931\u8D25",
		  "pill.unqueryable": "\u6682\u4E0D\u652F\u6301",
		  "quota.value": "{remaining}/{limit} \u6B21",
		  "tooltip.loading": "\u6B63\u5728\u67E5\u8BE2 {provider} \u4F59\u989D\u2026",
		  "tooltip.currency": "{provider} \u8D26\u6237\u4F59\u989D \xA5{balance}\uFF08\u70B9\u51FB\u5237\u65B0\uFF09",
		  "tooltip.quota": "{provider} \u914D\u989D\u5269\u4F59 {remaining}/{limit} \u6B21 \xB7 \u91CD\u7F6E\uFF1A{reset}\uFF08\u70B9\u51FB\u5237\u65B0\uFF09",
		  "tooltip.unqueryable": "{provider} \u6682\u4E0D\u652F\u6301\u4F59\u989D\u67E5\u8BE2\uFF08\u70B9\u51FB\u91CD\u8BD5\uFF09",
		  "tooltip.error": "\u4F59\u989D\u67E5\u8BE2\u5931\u8D25\uFF1A{message}\uFF08\u70B9\u51FB\u91CD\u8BD5\uFF09",
		  "aria.currency": "{provider} \u8D26\u6237\u4F59\u989D {balance} \u5143",
		  "aria.quota": "{provider} \u914D\u989D\u5269\u4F59 {remaining} \u6B21\uFF0C\u5171 {limit} \u6B21",
		  "aria.unqueryable": "{provider} \u6682\u4E0D\u652F\u6301\u4F59\u989D\u67E5\u8BE2",
		  "aria.error": "{provider} \u4F59\u989D\u67E5\u8BE2\u5931\u8D25\uFF1A{message}"
		};
		var en = {
		  "pill.querying": "Checking\u2026",
		  "pill.error": "Query failed",
		  "pill.unqueryable": "Not supported",
		  "quota.value": "{remaining}/{limit} req",
		  "tooltip.loading": "Querying {provider} balance\u2026",
		  "tooltip.currency": "{provider} account balance \xA5{balance} (click to refresh)",
		  "tooltip.quota": "{provider} quota {remaining}/{limit} requests left \xB7 resets {reset} (click to refresh)",
		  "tooltip.unqueryable": "{provider} balance query is not supported (click to retry)",
		  "tooltip.error": "Balance query failed: {message} (click to retry)",
		  "aria.currency": "{provider} account balance: {balance}",
		  "aria.quota": "{provider} quota: {remaining} of {limit} requests left",
		  "aria.unqueryable": "{provider} balance query is not supported",
		  "aria.error": "{provider} balance query failed: {message}"
		};
		var NS = "model-balance";
		var inject = ["slots", "locale", "modelDirectories"];
		function apply(ctx) {
		  ctx.effect(
		    () => ctx.locale.register(NS, { zh, en }),
		    "model-balance: dictionaries"
		  );
		  const directories = ctx.modelDirectories;
		  ctx.slots.inject(
		    "conversation.input.right",
		    () => ctx.slots.register(
		      {
		        name: "conversation.input.right",
		        id: "model-balance",
		        order: 100,
		        locale: NS,
		        inject: (sessionId) => ({
		          directory: directories.directoryFor(sessionId).store
		        })
		      },
		      BalancePill
		    )
		  );
		}

		return module.exports;
	}
});
