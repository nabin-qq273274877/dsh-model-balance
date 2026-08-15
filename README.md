# dsh-model-balance

[![npm](https://img.shields.io/npm/v/dsh-model-balance)](https://www.npmjs.com/package/dsh-model-balance)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

中文 | [English](README.en.md)

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web GUI 提供**多供应商真实账户余额**显示。

在 composer 的模型选择器**前面**显示余额胶囊。切换模型 → 立即显示该供应商的余额。每次用量变动自动刷新。

## 目前支持的供应商

| 供应商 | 查询接口 | 数据类型 | 状态 |
|--------|---------|---------|------|
| **DeepSeek** | `GET /user/balance` | 账户余额（¥） | ✅ 官方接口 |
| **StepFun** | `GET /v1/accounts` | 账户余额（¥） | ✅ 官方接口 |
| **Kimi Coding** | `GET /v1/usages` | 配额（7 天 + 5 小时） | ✅ 官方接口 |
| **OpenRouter** | `GET /api/v1/auth/key` | Credit 余额 ($) | ✅ 官方接口 |
| **MiniMax** | `GET /v1/token_plan/remains` | 剩余额度 | ✅ 官方接口 |
| **xAI / Grok** | `GET /v1/dashboard/billing/credit_grants` | Credit 余额 ($) | ✅ 官方接口 |
| **通义 Token Plan** | 百炼控制台 | 登录查看 | 🔗 需登录 |
| **小米 MiMo** | 小米平台控制台 | 登录查看 | 🔗 需登录 |
| Mistral、Groq、Cohere 等 | — | — | ⚠️ 暂不支持 |

> **添加新供应商？** 有两种方式：
> 1. **配置文件**（推荐）：编辑插件目录的 `providers.json` 或创建 `~/.dsh/model-balance-providers.json`
> 2. **提交 PR**：参见 [`src/host/strategies.ts`](src/host/strategies.ts) — 添加解析器 + 策略条目

## 显示状态

胶囊根据供应商类型显示四种状态：

### 金额余额

<p align="center"><img src="docs/images/currency.png" alt="金额余额" width="720"></p>

DeepSeek、StepFun、OpenRouter、xAI 等按金额计费的供应商，直接显示账户余额（点击刷新）。

### 额度百分比

<p align="center"><img src="docs/images/quota.png" alt="额度百分比" width="720"></p>

Kimi Coding 同时显示「7 天周额度」与「5 小时速率额度」的剩余百分比（鼠标悬停可看剩余次数与重置时间）。

### 登录查看

<p align="center"><img src="docs/images/login-required.png" alt="登录查看" width="720"></p>

千问（百炼 Token Plan）、小米 MiMo 等无 API 余额接口，点击在**新页面**打开对应控制台。

### 暂不支持

<p align="center"><img src="docs/images/unqueryable.png" alt="暂不支持" width="720"></p>

既无 API 接口也无公开控制台入口的供应商。

## 工作原理

```
┌─────────┐    GET /model-balance/query    ┌──────────┐   Bearer API key    ┌──────────────┐
│  浏览器  │ ──────────────────────────────→│ DSH 宿主 │ ──────────────────→│ 供应商 API   │
│  (胶囊)  │←──────────────────────────────│  (路由)   │←──────────────────│  (真实数据)  │
└─────────┘    JSON 信封                    └──────────┘   余额/配额        └──────────────┘
```

- **浏览器**：渲染胶囊，在模型切换 / 对话结束 / 定时轮询 / 点击时触发查询
- **宿主路由**（`/model-balance/query`）：从 DSH Credentials 解析供应商凭据，查询计费 API，缓存结果（成功 60 秒 / 失败 15 秒）
- **凭据安全**：API Key 永远不会到达浏览器

## 安装

```bash
# 通过 npm
npx @deepseek-ai/dsh plugin --profile web add dsh-model-balance

# 从 GitHub
npx @deepseek-ai/dsh plugin --profile web add github:nabin-qq273274877/dsh-model-balance

# 本地开发（link）
npx @deepseek-ai/dsh plugin --profile web add link:/path/to/dsh-model-balance
```

或者直接复制以下提示词给 AI：

```
请帮我安装 dsh-model-balance 插件，仓库地址：https://github.com/nabin-qq273274877/dsh-model-balance
按照 README 中的说明进行安装和配置。
```

然后重启 `dsh web` 并刷新页面。

## 卸载

```bash
npx @deepseek-ai/dsh plugin --profile web remove dsh-model-balance
```

## 自定义供应商

插件自带 `providers.json` 包含已支持的供应商配置。你可以：

1. **直接修改**插件目录下的 `providers.json`
2. **或创建** `~/.dsh/model-balance-providers.json`（优先级更高，会覆盖同名供应商）

配置文件格式：

```json
{
  "providers": {
    "your-provider": {
      "name": "显示名称",
      "baseURL": "https://api.example.com",
      "endpoint": "/v1/balance",
      "keyEnv": "YOUR_API_KEY",
      "response": {
        "type": "currency",
        "currency": "CNY",
        "balancePath": "data.balance"
      }
    }
  }
}
```

**字段说明**：

| 字段 | 必填 | 说明 |
|------|------|------|
| `name` | 否 | 显示名称 |
| `baseURL` | 是 | API 基础地址 |
| `endpoint` | 是 | 余额接口路径 |
| `keyEnv` | 是 | 存放 API Key 的环境变量名 |
| `response.type` | 是 | `currency`（余额）或 `quota`（配额） |
| `response.currency` | 否 | 货币代码，默认 `"CNY"` |
| `response.balancePath` | 是* | JSON path，如 `"data.balance"` |
| `response.limitPath` | 是* | 配额上限的 JSON path |
| `response.usedPath` | 是* | 已用配额的 JSON path |
| `response.remainingPath` | 是* | 剩余配额的 JSON path |
| `aliases` | 否 | 别名列表 |

修改后重启 `dsh web` 即可生效。

## 刷新策略

| 触发时机 | 绕过缓存 | 说明 |
|---------|---------|------|
| 切换模型 | 否 | 查询新供应商的余额（走宿主缓存） |
| 对话结束 | **是** | 刚刚消耗了额度，强制刷新 |
| 定时轮询 | 否 | 每 2 分钟自动刷新 |
| 点击胶囊 | **是** | 手动强制刷新 |

## 开发

```bash
git clone https://github.com/nabin-qq273274877/dsh-model-balance.git
cd dsh-model-balance
pnpm install
pnpm run build
pnpm test

# 链接到 DSH profile 进行实时测试
npx @deepseek-ai/dsh plugin --profile web add link:$(pwd)
```

## 项目结构

```
src/
├── types.ts              # 共享类型定义
├── host/
│   ├── index.ts          # 宿主插件：路由注册 + 缓存
│   └── strategies.ts     # 策略注册表 + URL 匹配 + 解析器
└── client/
    └── index.ts          # 客户端插件：BalancePill 组件 + 国际化

scripts/
└── build.ts              # esbuild：宿主 ESM + 客户端工厂打包

docs/
└── images/               # README 截图

test/
└── strategies.test.ts    # 策略匹配 + 解析器单元测试
```

## 许可证

[MIT](LICENSE)
