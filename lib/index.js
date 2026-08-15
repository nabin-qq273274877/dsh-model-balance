// src/host/custom-providers.ts
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
function getByPath(obj, path) {
  const keys = path.split(".");
  let current = obj;
  for (const key of keys) {
    if (current === null || current === void 0 || typeof current !== "object") {
      return void 0;
    }
    if (Array.isArray(current) && /^\d+$/.test(key)) {
      current = current[Number(key)];
    } else {
      current = current[key];
    }
  }
  return current;
}
function resolvePath(body, config) {
  if (typeof config === "string") {
    return getByPath(body, config);
  }
  if ("path" in config && !("find" in config) && !("expr" in config)) {
    return getByPath(body, config.path);
  }
  if ("find" in config) {
    const arrConfig = config;
    const arr = getByPath(body, arrConfig.path);
    if (!Array.isArray(arr)) return void 0;
    const item = arr.find((entry) => {
      if (entry === null || entry === null || typeof entry !== "object") return false;
      const fieldValue = entry[arrConfig.find.field];
      return fieldValue === arrConfig.find.equals;
    });
    if (item === void 0) return void 0;
    return item[arrConfig.value];
  }
  if ("expr" in config) {
    const exprConfig = config;
    return evaluateExpr(body, exprConfig.expr);
  }
  return void 0;
}
function evaluateExpr(body, expr) {
  const resolved = expr.replace(/([a-zA-Z_][\w.]*)/g, (match) => {
    if (["true", "false", "null", "undefined", "NaN", "Infinity"].includes(match)) {
      return match;
    }
    const value = getByPath(body, match);
    if (value === void 0 || value === null) return "NaN";
    if (typeof value === "string") return JSON.stringify(value);
    return String(value);
  });
  try {
    const fn = new Function(`"use strict"; return (${resolved})`);
    return fn();
  } catch {
    return void 0;
  }
}
function buildCurrencyParser(config) {
  return (body) => {
    const balance = Number(resolvePath(body, config.balance));
    if (!Number.isFinite(balance)) {
      throw new Error(`balance is not numeric`);
    }
    const available = config.available ? Boolean(getByPath(body, config.available)) : void 0;
    return {
      queryable: true,
      kind: "currency",
      currency: config.currency ?? "CNY",
      balance,
      ...available !== void 0 ? { available } : {}
    };
  };
}
function buildQuotaParser(config) {
  return (body) => {
    const limit = Number(resolvePath(body, config.limit));
    const used = Number(resolvePath(body, config.used));
    const remaining = Number(resolvePath(body, config.remaining));
    if (!Number.isFinite(limit) || !Number.isFinite(used) || !Number.isFinite(remaining)) {
      throw new Error(`quota values are not numeric`);
    }
    const resetTime = config.resetTime ? getByPath(body, config.resetTime) : void 0;
    return {
      queryable: true,
      kind: "quota",
      unit: "requests",
      limit,
      used,
      remaining,
      ...typeof resetTime === "string" ? { resetTime } : {}
    };
  };
}
function buildParser(response) {
  if (response.type === "currency") {
    return buildCurrencyParser(response);
  }
  return buildQuotaParser(response);
}
var USER_CONFIG_FILE = "model-balance-providers.json";
var BUNDLED_CONFIG_FILE = "providers.json";
function getBundledConfigPath() {
  try {
    const currentDir = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
    return join(currentDir, "..", "..", BUNDLED_CONFIG_FILE);
  } catch {
    return join(process.cwd(), BUNDLED_CONFIG_FILE);
  }
}
function getUserConfigPath() {
  const envPath = process.env.DSH_MODEL_BALANCE_CONFIG;
  if (envPath) return envPath;
  return join(homedir(), ".dsh", USER_CONFIG_FILE);
}
var cachedCustomStrategies = null;
function parseConfigFile(configPath) {
  if (!existsSync(configPath)) return {};
  try {
    const raw = readFileSync(configPath, "utf-8");
    const file = JSON.parse(raw);
    if (!file.providers || typeof file.providers !== "object") return {};
    const result = {};
    for (const [id, config] of Object.entries(file.providers)) {
      if (id.startsWith("_")) continue;
      if (!config.baseURL || !config.endpoint || !config.keyEnv || !config.response) {
        console.warn(`[dsh-model-balance] Skipping invalid provider "${id}": missing required fields`);
        continue;
      }
      result[id] = {
        suffix: config.endpoint,
        defaultBaseURL: config.baseURL,
        defaultKeyEnv: config.keyEnv,
        parse: buildParser(config.response),
        ...config.aliases ? { aliases: config.aliases } : {}
      };
    }
    return result;
  } catch (err) {
    console.error(`[dsh-model-balance] Failed to load config from ${configPath}:`, err);
    return {};
  }
}
function loadCustomProviders() {
  if (cachedCustomStrategies !== null) return cachedCustomStrategies;
  const bundled = parseConfigFile(getBundledConfigPath());
  const user = parseConfigFile(getUserConfigPath());
  cachedCustomStrategies = { ...bundled, ...user };
  return cachedCustomStrategies;
}

// src/host/strategies.ts
function parseDeepSeek(body) {
  const infos = body?.balance_infos;
  if (!Array.isArray(infos) || infos.length === 0) {
    throw new Error("unexpected deepseek balance response");
  }
  const entry = infos.find(
    (i) => i?.currency === "CNY"
  ) ?? infos[0];
  const balance = Number(entry?.total_balance);
  if (!Number.isFinite(balance)) {
    throw new Error("deepseek balance is not numeric");
  }
  return {
    queryable: true,
    kind: "currency",
    currency: typeof entry.currency === "string" ? entry.currency : "CNY",
    balance,
    granted: Number(entry.granted_balance) || 0,
    toppedUp: Number(entry.topped_up_balance) || 0,
    available: body.is_available !== false
  };
}
function parseStepFun(body) {
  const b = body;
  const balance = Number(b?.balance);
  if (!Number.isFinite(balance)) {
    throw new Error("unexpected stepfun accounts response");
  }
  return {
    queryable: true,
    kind: "currency",
    currency: "CNY",
    balance,
    cash: Number(b?.total_cash_balance) || 0,
    voucher: Number(b?.total_voucher_balance) || 0
  };
}
function parseKimiCoding(body) {
  const usage = body?.usage;
  const limit = Number(usage?.limit);
  const used = Number(usage?.used);
  const remaining = Number(usage?.remaining);
  if (!Number.isFinite(limit) || !Number.isFinite(used) || !Number.isFinite(remaining)) {
    throw new Error("unexpected kimi usages response");
  }
  return {
    queryable: true,
    kind: "quota",
    unit: "requests",
    limit,
    used,
    remaining,
    ...typeof usage?.resetTime === "string" ? { resetTime: usage.resetTime } : {}
  };
}
function parseOpenRouter(body) {
  const data = body?.data;
  if (!data) throw new Error("unexpected openrouter auth/key response");
  const limitCents = Number(data.limit);
  const usageCents = Number(data.usage);
  if (!Number.isFinite(limitCents)) throw new Error("openrouter limit is not numeric");
  const balance = limitCents > 0 ? (limitCents - usageCents) / 100 : 0;
  return {
    queryable: true,
    kind: "currency",
    currency: "USD",
    balance
  };
}
function parseMiniMax(body) {
  const b = body;
  const remaining = Number(b?.data ?? b?.remaining);
  const total = Number(b?.total ?? b?.limit);
  if (!Number.isFinite(remaining)) throw new Error("unexpected minimax remains response");
  return {
    queryable: true,
    kind: "quota",
    unit: "requests",
    limit: Number.isFinite(total) ? total : 0,
    used: Number.isFinite(total) && Number.isFinite(remaining) ? total - remaining : 0,
    remaining
  };
}
function parseXai(body) {
  const b = body;
  const balance = Number(b?.balance ?? b?.total_granted);
  if (!Number.isFinite(balance)) throw new Error("unexpected xai credit response");
  return {
    queryable: true,
    kind: "currency",
    currency: "USD",
    balance
  };
}
var STRATEGIES = {
  deepseek: {
    suffix: "/user/balance",
    defaultBaseURL: "https://api.deepseek.com",
    defaultKeyEnv: "DEEPSEEK_API_KEY",
    parse: parseDeepSeek,
    aliases: ["deepseek-official"]
  },
  stepfun: {
    suffix: "/accounts",
    defaultBaseURL: "https://api.stepfun.com/v1",
    defaultKeyEnv: "STEPFUN_API_KEY",
    parse: parseStepFun
  },
  "kimi-coding": {
    suffix: "/v1/usages",
    defaultBaseURL: "https://api.kimi.com/coding",
    defaultKeyEnv: "KIMI_API_KEY",
    parse: parseKimiCoding
  },
  openrouter: {
    suffix: "/api/v1/auth/key",
    defaultBaseURL: "https://openrouter.ai",
    defaultKeyEnv: "OPENROUTER_API_KEY",
    parse: parseOpenRouter
  },
  minimax: {
    suffix: "/v1/token_plan/remains",
    defaultBaseURL: "https://api.minimax.chat",
    defaultKeyEnv: "MINIMAX_API_KEY",
    parse: parseMiniMax
  },
  xai: {
    suffix: "/v1/dashboard/billing/credit_grants",
    defaultBaseURL: "https://api.x.ai",
    defaultKeyEnv: "XAI_API_KEY",
    parse: parseXai,
    aliases: ["xai", "grok"]
  }
};
var KNOWN_IDS = /* @__PURE__ */ new Map();
for (const [canonical, strategy] of Object.entries(STRATEGIES)) {
  KNOWN_IDS.set(canonical.toLowerCase(), canonical);
  for (const alias of strategy.aliases ?? []) {
    KNOWN_IDS.set(alias.toLowerCase(), canonical);
  }
}
var URL_MATCHERS = [
  [/api\.deepseek\.com/i, "deepseek"],
  [/api\.stepfun\.com/i, "stepfun"],
  [/api\.kimi\.com/i, "kimi-coding"],
  [/openrouter\.ai/i, "openrouter"],
  [/api\.minimax\.chat/i, "minimax"],
  [/api\.x\.ai/i, "xai"],
  [/platform\.stepfun\.com/i, "stepfun"],
  [/coding\.dashscope/i, "qwen-coding-plan"],
  [/maas\.aliyuncs\.com/i, "qwen-token-plan"],
  [/xiaomimimo\.com/i, "xiaomi"]
];
function getAllStrategies() {
  const custom = loadCustomProviders();
  return { ...custom, ...STRATEGIES };
}
function buildKnownIds() {
  const map = /* @__PURE__ */ new Map();
  const all = getAllStrategies();
  for (const [canonical, strategy] of Object.entries(all)) {
    map.set(canonical.toLowerCase(), canonical);
    for (const alias of strategy.aliases ?? []) {
      map.set(alias.toLowerCase(), canonical);
    }
  }
  return map;
}
function matchStrategy(providerId, configuredBaseURL, configuredKeyEnv) {
  const allStrategies = getAllStrategies();
  const allKnownIds = buildKnownIds();
  const canonical = allKnownIds.get(providerId.toLowerCase());
  if (canonical !== void 0) {
    const s = allStrategies[canonical];
    if (s) {
      const base = stripSlash(configuredBaseURL ?? s.defaultBaseURL);
      return {
        url: `${base}${s.suffix}`,
        keyEnv: configuredKeyEnv ?? s.defaultKeyEnv,
        canonical,
        parse: s.parse
      };
    }
  }
  const baseURL = configuredBaseURL;
  if (baseURL !== void 0) {
    for (const [pattern, key] of URL_MATCHERS) {
      if (pattern.test(baseURL)) {
        const s = allStrategies[key];
        if (s !== void 0) {
          return {
            url: `${stripSlash(baseURL)}${s.suffix}`,
            keyEnv: configuredKeyEnv ?? s.defaultKeyEnv,
            canonical: key,
            parse: s.parse
          };
        }
      }
    }
  }
  return void 0;
}
function stripSlash(url) {
  return url.replace(/\/+$/, "");
}

// src/host/index.ts
var name = "model-balance";
var inject = ["webServer", "settings", "credentials"];
var ROUTE_PATH = "/model-balance/query";
var OK_TTL_MS = 6e4;
var ERROR_TTL_MS = 15e3;
var PROVIDER_TIMEOUT_MS = 15e3;
function parseQuery(reqUrl) {
  const url = new URL(reqUrl, "http://localhost");
  const provider = url.searchParams.get("provider");
  return {
    provider: provider === null || provider === "" ? null : provider,
    refresh: url.searchParams.get("refresh") === "1"
  };
}
function sendJson(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(body));
}
function readSection(settings, ns) {
  try {
    const value = settings.get(ns);
    if (value === void 0 || value === null || typeof value !== "object") return void 0;
    return value;
  } catch {
    return void 0;
  }
}
async function fetchProviderJson(url, apiKey) {
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${apiKey}`,
      accept: "application/json"
    },
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = void 0;
  }
  return { status: response.status, body };
}
function apply(ctx) {
  const cache = /* @__PURE__ */ new Map();
  async function queryProvider(providerId) {
    const piAi = readSection(ctx.settings, "llm-pi-ai");
    const profile = piAi?.providers?.[providerId];
    const configuredBaseURL = typeof profile?.baseURL === "string" && profile.baseURL !== "" ? profile.baseURL : void 0;
    let configuredKeyEnv = typeof profile?.apiKeyEnv === "string" && profile.apiKeyEnv !== "" ? profile.apiKeyEnv : void 0;
    if (configuredKeyEnv === void 0) {
      const deepseek = readSection(ctx.settings, "llm-deepseek");
      if (typeof deepseek?.apiKeyEnv === "string" && deepseek.apiKeyEnv !== "") {
        configuredKeyEnv = deepseek.apiKeyEnv;
      }
    }
    const strategy = matchStrategy(providerId, configuredBaseURL, configuredKeyEnv);
    if (strategy === void 0) {
      return { queryable: false, reason: "no-balance-api", provider: providerId };
    }
    const credential = await ctx.credentials.resolve(strategy.keyEnv);
    if (credential === void 0 || !credential.value) {
      throw new Error(`credential "${strategy.keyEnv}" is not configured`);
    }
    const { status, body } = await fetchProviderJson(strategy.url, credential.value);
    if (status !== 200) {
      const detail = body?.error?.message ?? body?.message ?? "";
      throw new Error(
        `provider answered HTTP ${status}${detail === "" ? "" : `: ${detail}`}`
      );
    }
    return strategy.parse(body);
  }
  const handler = async (req, res) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, {
          ok: false,
          error: { code: "method-not-allowed", message: "GET only" }
        });
        return;
      }
      const { provider, refresh } = parseQuery(req.url ?? "/");
      if (provider === null) {
        sendJson(res, 400, {
          ok: false,
          error: { code: "bad-request", message: "missing provider" }
        });
        return;
      }
      const cached = cache.get(provider);
      if (!refresh && cached !== void 0 && Date.now() - cached.at < (cached.ok ? OK_TTL_MS : ERROR_TTL_MS)) {
        sendJson(res, 200, cached.envelope);
        return;
      }
      let envelope;
      try {
        const value = await queryProvider(provider);
        envelope = { ok: true, value };
      } catch (error) {
        envelope = {
          ok: false,
          error: {
            code: "provider-query-failed",
            message: error instanceof Error ? error.message : String(error)
          }
        };
      }
      cache.set(provider, {
        at: Date.now(),
        ok: envelope.ok === true,
        envelope
      });
      sendJson(res, 200, envelope);
    } catch (error) {
      try {
        sendJson(res, 500, {
          ok: false,
          error: {
            code: "internal",
            message: error instanceof Error ? error.message : String(error)
          }
        });
      } catch {
      }
    }
  };
  const disposeRoute = ctx.webServer.register({
    kind: "exact",
    path: ROUTE_PATH,
    handler
  });
  return () => {
    disposeRoute();
    cache.clear();
  };
}
export {
  apply,
  inject,
  name
};
//# sourceMappingURL=index.js.map
