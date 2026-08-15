window.__ModuleLoader__.load({
	id: "dsh-model-balance",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		"use strict";
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
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
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
		  // If the importer is in node compatibility mode or this is not an ESM
		  // file that has been converted to a CommonJS file using a Babel-
		  // compatible transform (i.e. "__esModule" has not been set), then set
		  // "default" to the CommonJS "module.exports" for node compatibility.
		  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
		  mod
		));
		var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

		// src/client/index.ts
		var index_exports = {};
		__export(index_exports, {
		  BalancePill: () => BalancePill,
		  apply: () => apply,
		  inject: () => inject
		});
		module.exports = __toCommonJS(index_exports);
		var React = __toESM(require("react"), 1);
		var import_jsx_runtime = require("react/jsx-runtime");
		function h(type, props, ...children) {
		  return (0, import_jsx_runtime.jsx)(type, { ...props, children });
		}
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
		function ExternalIcon() {
		  return h(
		    "svg",
		    { viewBox: "0 0 14 14", width: 12, height: 12, "aria-hidden": true },
		    h("path", {
		      d: "M8.5 2.5h3v3M11.5 2.5 6.5 7.5M7 3.5H4a.5.5 0 0 0-.5.5v6a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5V7",
		      fill: "none",
		      stroke: "currentColor",
		      strokeWidth: 1.2,
		      strokeLinecap: "round",
		      strokeLinejoin: "round"
		    })
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
		function quotaWindowLabel(t, window2) {
		  if (window2 === "weekly") return t("quota.window.weekly");
		  if (window2 === "hourly") return t("quota.window.hourly");
		  return window2;
		}
		function quotaPercent(remaining, limit) {
		  return limit > 0 ? Math.round(remaining / limit * 100) : 0;
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
		  const { directory, session, t, load } = props;
		  const { useSyncExternalStore, useState, useRef, useEffect, useCallback } = React;
		  const state = useSyncExternalStore(
		    (fn) => directory.subscribe(fn),
		    () => directory.getSnapshot()
		  );
		  const running = session?.running ?? false;
		  const current = state.current;
		  const provider = current === null ? null : current.provider;
		  useEffect(() => {
		    load?.();
		  }, [load]);
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
		    return h(
		      "div",
		      {
		        className: CLS.root,
		        "data-tone": "dim",
		        title: t("tooltip.loading", { provider: groupName })
		      },
		      h("span", { className: CLS.icon }, h(CoinIcon, {})),
		      h("span", {}, t("pill.querying"))
		    );
		  }
		  if (query.status === "error") {
		    return h(
		      "button",
		      {
		        type: "button",
		        className: CLS.root,
		        "data-tone": "error",
		        title: t("tooltip.error", { message: query.message }),
		        "aria-label": t("aria.error", { provider: groupName, message: query.message }),
		        onClick: () => runQuery(provider, true)
		      },
		      h("span", { className: CLS.icon }, h(WarnIcon, {})),
		      h("span", {}, t("pill.error"))
		    );
		  }
		  const value = query.value;
		  if (value.queryable === false) {
		    if (value.reason === "login-required" && value.loginUrl !== void 0) {
		      const url = value.loginUrl;
		      return h(
		        "button",
		        {
		          type: "button",
		          className: CLS.root,
		          "data-tone": "dim",
		          title: t("tooltip.login", { provider: groupName, url }),
		          "aria-label": t("aria.login", { provider: groupName }),
		          onClick: () => {
		            window.open(url, "_blank", "noopener,noreferrer");
		          }
		        },
		        h("span", { className: CLS.icon }, h(ExternalIcon, {})),
		        h("span", {}, t("pill.login"))
		      );
		    }
		    return h(
		      "button",
		      {
		        type: "button",
		        className: CLS.root,
		        "data-tone": "error",
		        title: t("tooltip.unqueryable", { provider: groupName }),
		        "aria-label": t("aria.unqueryable", { provider: groupName }),
		        onClick: () => runQuery(provider, true)
		      },
		      h("span", { className: CLS.icon }, h(WarnIcon, {})),
		      h("span", {}, t("pill.unqueryable"))
		    );
		  }
		  if (value.kind === "quota") {
		    const dims = value.dims !== void 0 && value.dims.length > 1 ? value.dims : void 0;
		    const toneOf = (remaining, limit) => remaining <= 0 ? "error" : limit > 0 && remaining <= limit * 0.1 ? "warn" : void 0;
		    const tone2 = dims !== void 0 ? dims.reduce(
		      (acc, d) => acc === "error" ? acc : toneOf(d.remaining, d.limit) ?? acc,
		      void 0
		    ) : toneOf(value.remaining, value.limit);
		    const quotaText = dims !== void 0 ? dims.map(
		      (d) => `${quotaWindowLabel(t, d.window)} ${quotaPercent(d.remaining, d.limit)}%`
		    ).join(" \xB7 ") : t("quota.value", { remaining: value.remaining, limit: value.limit });
		    const title = dims !== void 0 ? t("tooltip.quota.dims", {
		      provider: groupName,
		      dims: dims.map(
		        (d) => `${quotaWindowLabel(t, d.window)} ${quotaPercent(d.remaining, d.limit)}% (${d.remaining}/${d.limit})` + (d.resetTime !== void 0 ? ` \xB7 ${t("tooltip.quota.resets")} ${formatReset(d.resetTime)}` : "")
		      ).join("\n")
		    }) : t("tooltip.quota", {
		      provider: groupName,
		      remaining: value.remaining,
		      limit: value.limit,
		      reset: value.resetTime !== void 0 ? formatReset(value.resetTime) : "?"
		    });
		    const ariaLabel = dims !== void 0 ? t("aria.quota.dims", { provider: groupName, dims: quotaText }) : t("aria.quota", {
		      provider: groupName,
		      remaining: value.remaining,
		      limit: value.limit
		    });
		    return h(
		      "button",
		      {
		        type: "button",
		        className: CLS.root,
		        ...tone2 !== void 0 ? { "data-tone": tone2 } : {},
		        title,
		        "aria-label": ariaLabel,
		        onClick: () => runQuery(provider, true)
		      },
		      h("span", { className: CLS.icon }, h(GaugeIcon, {})),
		      h("span", {}, quotaText)
		    );
		  }
		  const symbol = symbolOf(value.currency);
		  const balanceText = `${symbol} ${value.balance.toFixed(2)}`;
		  const tone = value.balance <= 5e-3 ? "error" : value.balance < 20 ? "warn" : void 0;
		  return h(
		    "button",
		    {
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
		      onClick: () => runQuery(provider, true)
		    },
		    h("span", { className: CLS.icon }, h(CoinIcon, {})),
		    h("span", {}, balanceText)
		  );
		}
		var zh = {
		  "pill.querying": "\u67E5\u8BE2\u4E2D\u2026",
		  "pill.error": "\u67E5\u8BE2\u5931\u8D25",
		  "pill.unqueryable": "\u6682\u4E0D\u652F\u6301",
		  "pill.login": "\u70B9\u51FB\u767B\u5F55\u67E5\u770B",
		  "quota.value": "{remaining}/{limit} \u6B21",
		  "quota.window.weekly": "7d",
		  "quota.window.hourly": "5h",
		  "tooltip.loading": "\u6B63\u5728\u67E5\u8BE2 {provider} \u4F59\u989D\u2026",
		  "tooltip.currency": "{provider} \u8D26\u6237\u4F59\u989D \xA5{balance}\uFF08\u70B9\u51FB\u5237\u65B0\uFF09",
		  "tooltip.quota": "{provider} \u914D\u989D\u5269\u4F59 {remaining}/{limit} \u6B21 \xB7 \u91CD\u7F6E\uFF1A{reset}\uFF08\u70B9\u51FB\u5237\u65B0\uFF09",
		  "tooltip.quota.dims": "{provider} \u914D\u989D\uFF1A{dims}\uFF08\u70B9\u51FB\u5237\u65B0\uFF09",
		  "tooltip.quota.resets": "\u91CD\u7F6E",
		  "tooltip.unqueryable": "{provider} \u6682\u4E0D\u652F\u6301\u4F59\u989D\u67E5\u8BE2\uFF08\u70B9\u51FB\u91CD\u8BD5\uFF09",
		  "tooltip.login": "{provider} \u4F59\u989D\u9700\u767B\u5F55\u7F51\u9875\u67E5\u770B\uFF08\u70B9\u51FB\u6253\u5F00\uFF09",
		  "tooltip.error": "\u4F59\u989D\u67E5\u8BE2\u5931\u8D25\uFF1A{message}\uFF08\u70B9\u51FB\u91CD\u8BD5\uFF09",
		  "aria.currency": "{provider} \u8D26\u6237\u4F59\u989D {balance} \u5143",
		  "aria.quota": "{provider} \u914D\u989D\u5269\u4F59 {remaining} \u6B21\uFF0C\u5171 {limit} \u6B21",
		  "aria.quota.dims": "{provider} \u914D\u989D\uFF1A{dims}",
		  "aria.unqueryable": "{provider} \u6682\u4E0D\u652F\u6301\u4F59\u989D\u67E5\u8BE2",
		  "aria.login": "{provider} \u4F59\u989D\u9700\u767B\u5F55\u67E5\u770B",
		  "aria.error": "{provider} \u4F59\u989D\u67E5\u8BE2\u5931\u8D25\uFF1A{message}"
		};
		var en = {
		  "pill.querying": "Checking\u2026",
		  "pill.error": "Query failed",
		  "pill.unqueryable": "Not supported",
		  "pill.login": "Log in to view",
		  "quota.value": "{remaining}/{limit} req",
		  "quota.window.weekly": "7d",
		  "quota.window.hourly": "5h",
		  "tooltip.loading": "Querying {provider} balance\u2026",
		  "tooltip.currency": "{provider} account balance \xA5{balance} (click to refresh)",
		  "tooltip.quota": "{provider} quota {remaining}/{limit} requests left \xB7 resets {reset} (click to refresh)",
		  "tooltip.quota.dims": "{provider} quota: {dims} (click to refresh)",
		  "tooltip.quota.resets": "resets",
		  "tooltip.unqueryable": "{provider} balance query is not supported (click to retry)",
		  "tooltip.login": "{provider} balance requires login (click to open)",
		  "tooltip.error": "Balance query failed: {message} (click to retry)",
		  "aria.currency": "{provider} account balance: {balance}",
		  "aria.quota": "{provider} quota: {remaining} of {limit} requests left",
		  "aria.quota.dims": "{provider} quota: {dims}",
		  "aria.unqueryable": "{provider} balance query is not supported",
		  "aria.login": "{provider} balance requires login",
		  "aria.error": "{provider} balance query failed: {message}"
		};
		var NS = "model-balance";
		var inject = ["slots", "locale", "modelDirectories"];
		function apply(ctx) {
		  ctx.effect(
		    () => ctx.locale.register(NS, { zh, en }),
		    "model-balance: dictionaries"
		  );
		  ctx.inject(["slots", "modelDirectories"], (scope) => {
		    const models = scope.modelDirectories;
		    scope.slots.inject(
		      "conversation.input.right",
		      () => scope.slots.register(
		        {
		          name: "conversation.input.right",
		          id: "model-balance",
		          order: 100,
		          locale: NS,
		          inject: (sessionId) => {
		            const directory = models.directoryFor(sessionId);
		            return {
		              directory: directory.store,
		              load: () => {
		                directory.load().catch(() => {
		                });
		              }
		            };
		          }
		        },
		        BalancePill
		      )
		    );
		  });
		}

		return module.exports;
	}
});
