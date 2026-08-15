# DeepSeek Usage Monitor (DSH Plugin)

A dynamic [Cordis](https://cordis.js.org) plugin for the [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/DeepSeek-Harness) that brings your DeepSeek API **account balance, monthly spend, per-model token usage, and a 7-day usage trend chart** right into the DSH settings panel — no extra app, no build step.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: DeepSeek Harness](https://img.shields.io/badge/Platform-DSH-4d6bfe)](https://github.com/deepseek-ai/DeepSeek-Harness)
[![Docs: 简体中文](https://img.shields.io/badge/Docs-简体中文-e03131)](README.md)

> Functionality is inspired by [JayHome137/DeepSeekMonitorWindows](https://github.com/JayHome137/DeepSeekMonitorWindows) (MIT License). Thanks to the original authors. **This is not an official DeepSeek product.**

---

## Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Requirements](#requirements)
- [Installation](#installation)
- [Configuring Credentials](#configuring-credentials)
- [Data Storage & Security](#data-storage--security)
- [How It Works](#how-it-works)
- [RPC Reference](#rpc-reference)
- [Repository Layout](#repository-layout)
- [FAQ](#faq)
- [Disclaimer](#disclaimer)
- [Credits](#credits)
- [License](#license)

## Features

| Area | Details |
| --- | --- |
| 💰 **Balance** | Total / granted / topped-up balance from the official `GET https://api.deepseek.com/user/balance` endpoint (requires an API Key) |
| 📊 **Platform usage** | Monthly cost, V4 Flash & V4 Pro total tokens, request count, cache-hit / cache-miss / output tokens — pulled from the web-console usage APIs (requires the web login token) |
| 📈 **Trend chart** | Stacked 7-day token trend (Flash vs. Pro) as a lightweight, dependency-free bar chart; automatically merges the previous month when the window crosses a month boundary |
| 🔄 **Auto refresh** | Optional background refresh at 1 / 5 / 30 / 60 minute intervals |
| 🔐 **Credentials** | Save / clear API Key and usage token; the usage token is validated against the platform API on save |
| 🚪 **Two entry points** | A permanent page in the DSH settings panel **and** the same panel embedded in the latest `cordis_run` card in the conversation |
| 🎨 **Theme aware** | All colors use DSH theme tokens (`--dsw-alias-*`), so light / dark mode just works |

## Screenshots

| Dashboard (总览) | Settings (设置) |
| :---: | :---: |
| ![Dashboard](screenshots/dashboard.png) | ![Settings](screenshots/settings.png) |

## Requirements

- A DSH instance with dynamic Cordis plugins enabled
- `curl` available on the Host machine's `PATH` (ships with Windows 10+; on Linux/macOS it is usually preinstalled)
- A DeepSeek API Key (for balance) and a platform web-login token (for usage) — see [Configuring Credentials](#configuring-credentials)

## Installation

This plugin is a **dynamic Cordis plugin**: it is defined at runtime with the `cordis_define` tool, no compilation or file installation required.

### Option 1: one-prompt install (recommended)

Paste the prompt below into a DSH conversation. The DSH agent reads the plugin sources from this repo, defines the plugin, and activates it for you:

````text
Please install the DeepSeek Usage Monitor plugin (a DSH dynamic Cordis plugin):
1. Get the source: run "git clone https://github.com/xiaohai-ouyang/deepseek-usage-monitor" (or read plugin-host.js and plugin-client.js from the repo directly).
2. Call cordis_define:
   - plugin.kind = "new", idPrefix = "dsmon", name = "Usage Monitor"
   - code.host: paste the whole function body starting at "return {" from plugin-host.js
   - code.client: paste the whole function body starting at "return {" from plugin-client.js
3. Call cordis_run with the returned pluginId / packageId (approve the Client package on its first run).
4. After activation, tell the user to open Settings → "用量监控" and configure:
   - API Key from platform.deepseek.com → API Keys (sk-...) for balance queries
   - Usage token: run JSON.parse(localStorage.userToken).value in the browser console of a logged-in platform.deepseek.com session
````

### Option 2: paste the function bodies manually

1. In a DSH conversation, call `cordis_define`:
   - `plugin.kind`: `"new"`, `idPrefix`: e.g. `"dsmon"`
   - `code.host`: paste the whole function body (starting at `return {`) from [`plugin-host.js`](plugin-host.js)
   - `code.client`: paste the whole function body from [`plugin-client.js`](plugin-client.js)
2. Call `cordis_run` with the returned `pluginId` / `packageId`.
3. The first run of a Client package needs your approval — allow it in the run card that appears in the conversation.
4. Open **Settings → “用量监控”** in the DSH sidebar and configure your credentials.

Updates follow the same flow: append a new Package to the same `pluginId` and `cordis_run` it with `mode: "update"`. Roll back with `mode: "run"` and the previous `packageId`.

## Configuring Credentials

Two separate credentials are used, because DeepSeek offers no official usage API:

**1. API Key — balance queries**
From [platform.deepseek.com](https://platform.deepseek.com) → **API Keys**, e.g. `sk-…`. Paste it on the Settings tab and hit **保存** (Save). The plugin immediately verifies it and fetches your balance.

**2. Usage token — usage statistics**
Log in to [platform.deepseek.com](https://platform.deepseek.com) in a browser, open the developer console and run:

```js
JSON.parse(localStorage.userToken).value
```

Paste the returned string and hit **保存并验证** (Save & verify). The plugin calls the platform usage API once to confirm the token is valid.

> The usage token is a web session credential and **can expire**. If usage queries return `401`, repeat the step above.

## Data Storage & Security

Credentials are stored in **plain text** in the DSH workspace root:

```text
<workspace>/.deepseek-monitor.config.json
```

- Never commit, share, or screenshot this file.
- The API Key and the usage token are sensitive credentials; you are responsible for the risks of local storage, account security, and the network requests this plugin makes.
- The token is passed to `curl` as an `Authorization` header argument, so it can briefly appear in the local process list during a request. Do not run this plugin on a machine where you cannot trust other local users.

## How It Works

### Host half (`plugin-host.js`)

Runs inside the DSH Node.js process:

- DSH's `web.fetch` service cannot send custom headers, so authenticated requests are executed by spawning the system `curl.exe` through the `subprocess` service (collect-mode stdio, bounded output, `--max-time` per request).
- Endpoints:
  - Balance: `GET https://api.deepseek.com/user/balance` (Bearer API Key)
  - Usage: `GET https://platform.deepseek.com/api/v0/usage/amount?month=<M>&year=<Y>` and `GET https://platform.deepseek.com/api/v0/usage/cost?month=<M>&year=<Y>` (Bearer web token, `x-app-version: 1.0.0`)
- Token kinds are aggregated exactly like the reference project: `REQUEST`, `PROMPT_CACHE_HIT_TOKEN`, `PROMPT_CACHE_MISS_TOKEN`, `RESPONSE_TOKEN`, `PROMPT_TOKEN`.
- Config persistence uses the `fs` service; the latest balance / usage snapshots are cached in memory so the UI can repaint instantly.
- Client RPC is exposed through `harness.handle` (package-private, JSON-only).

### Client half (`plugin-client.js`)

- Registers the panel in two slots: `settings.section` (permanent settings page, id `deepseek-monitor`) and `tool.view.cordis` (key `self`, rendered in the latest `cordis_run` card).
- Pure `React.createElement` (no JSX/TypeScript), styled with a package-scoped stylesheet built on DSH theme variables.
- Talks to the Host via `host.call`; the auto-refresh loop uses the `timer` service and disposes cleanly with the plugin fiber.

## RPC Reference

Methods exposed by the Host half (`harness.handle`):

| Method | Args | Returns |
| --- | --- | --- |
| `get-state` | — | Masked config summary, cached balance/usage, update timestamp |
| `save-config` | `{ apiKey?, usageToken?, refreshIntervalSeconds?, autoRefreshEnabled? }` | `{ ok, tokenValid?, tokenError? }` — validates a newly saved usage token |
| `clear-credentials` | `{ field: 'apiKey' \| 'usageToken' }` | `{ ok }` |
| `fetch-balance` | — | `{ ok, data? \| error? }` |
| `fetch-usage` | — | `{ ok, data? \| error? }` (current month + previous month when the 7-day window crosses over) |
| `refresh-all` | — | `{ balance, usage, lastUpdatedAt }` |

## Repository Layout

```text
deepseek-usage-monitor/
├── plugin-host.js     # code.host — data fetching, credential persistence, RPC
├── plugin-client.js   # code.client — panel UI, auto refresh
├── screenshots/       # README images (placeholders; replace with real shots)
├── README.md          # 简体中文说明（默认）
├── README.en.md       # this file
├── LICENSE            # MIT
└── package.json       # repo metadata
```

## FAQ

**Why curl instead of fetch?** — DSH's `web.fetch` request shape only carries a URL; it cannot attach `Authorization` headers. The Host's `subprocess` service lets the plugin reuse the OS-installed `curl` with full header control.

**Why do I need a web token at all?** — DeepSeek does not publish a usage API. The web console fetches usage from internal endpoints that authenticate with the browser session token captured via `localStorage.userToken`.

**The usage query returns 401.** — Your usage token expired. Grab a fresh one from the browser console (see above) and save it again.

**Where is my data?** — Only locally, in the workspace config file described above. The plugin never uploads anything anywhere else.

**Will this survive a DSH restart?** — Dynamic plugins are process-local: after a restart, re-define and re-run the plugin (credentials in the config file survive).

## Disclaimer

For learning and personal usage monitoring only. Please respect DeepSeek's Terms of Use, keep request frequency reasonable, and be aware that the platform's page structure, login flow, and internal endpoints may change at any time — long-term availability is not guaranteed.

## Credits

- [JayHome137/DeepSeekMonitorWindows](https://github.com/JayHome137/DeepSeekMonitorWindows) — Windows desktop monitor whose endpoints and token aggregation this plugin follows (MIT)
- [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) — the host platform for dynamic Cordis plugins

## License

[MIT](LICENSE) © 2026 Xiao Hi
