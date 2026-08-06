# Crypto Tools

A collection of cryptocurrency tools for [Kraken](https://www.kraken.com/) and [Binance](https://www.binance.com/) exchanges. Built with Vite, React, React Router, Hono, Tailwind CSS and [shadcn/ui](https://ui.shadcn.com/); the desktop app is powered by [Electrobun](https://electrobun.dev/).

![Home](public/screenshot-home.png)

## Features

### Kraken

- **Order Batch** — Create multiple buy or sell post-limit orders for a trading pair with configurable price and volume distribution functions. Supports dry-run mode for safe testing.
- **Closed Orders** — Browse every order that filled, read from the local database rather than the API. Orders are rebuilt from your stored trade history, so an order filled in several trades appears once with its total volume and the average price it achieved. Sortable and paginated, filterable by pair, side, order type, date range and order id.
- **Ledger** — Download your complete ledger (trades, deposits, withdrawals, staking and earn rewards) and your trade history through Kraken's export report endpoints and keep both in a local SQLite database, so other tools can use them without querying the API again. Syncs incrementally, and shows the stored date range, last sync time, entry and trade counts alongside a filterable table of entries.
- **Fees** — Dashboard of everything Kraken has charged since the account was opened — trade fees, withdrawal fees and anything else the ledger records — read from the local database. Totals per asset, a breakdown by ledger entry type, and a stacked chart over time by month, quarter or year. Fees are kept in the asset they were charged in and never converted between currencies.
- **Balances** — View spot and staking account balances.
- **xStocks** — AI-powered classification of Kraken tokenized assets (stocks and ETFs) using Anthropic Claude. Generates descriptions with configurable word count and supports filtering by asset type.

![Kraken Order Batch](public/screenshot-kraken-order-batch.png)

![Kraken Closed Orders](public/screenshot-kraken-closed-orders.png)

![Kraken xStocks](public/screenshot-kraken-xstocks.png)

### Binance

- **Staking Overview** — Overview of spot wallet balances and locked staking positions, including available and sold-out staking products for each asset. Shows next redemptions sorted by date, per-asset breakdowns with fiat valuations, and staking product details with quota analysis.

![Binance Staking](public/screenshot-binance-staking.png)

## Desktop App

Standalone desktop apps are available for macOS (Apple Silicon) and Windows — no Bun or Git required.

**macOS (recommended — Homebrew):**

```sh
brew install --cask nyg/tap/crypto-tools
```

This handles the Gatekeeper step for you (see below), so the app launches normally.

**Windows (recommended — Scoop):**

```powershell
scoop bucket add nyg https://github.com/nyg/scoop-bucket
scoop install crypto-tools
```

Scoop installs per-user (no admin rights) and avoids the SmartScreen prompt (see [Windows SmartScreen](#windows-smartscreen) below). If you don't have Scoop, install it first (no admin required):

```powershell
irm get.scoop.sh | iex
```

**macOS (manual) / Windows (manual):**

1. Download the installer from the [releases page](https://github.com/nyg/crypto-tools/releases):
   - macOS (Apple Silicon): `crypto-tools-<version>-macos-arm64.dmg`
   - Windows (x64): `crypto-tools-<version>-windows-x64-setup.zip`
2. **macOS**: open the DMG, drag **Crypto Tools.app** to your **Applications** folder, then see [macOS Gatekeeper](#macos-gatekeeper) below before first launch
3. **Windows**: extract the ZIP and run **Crypto Tools-Setup.exe** inside (installs per-user to `%LOCALAPPDATA%` — no admin rights). See [Windows SmartScreen](#windows-smartscreen) below before first launch.

API keys can be configured in the app on the **Settings** page (stored in `localStorage`).

### macOS Gatekeeper

The app is **ad-hoc signed but not notarized** (it is not signed with a paid Apple Developer certificate). It is **not damaged or corrupted** — but because it is not notarized, macOS quarantines it after download and blocks the first launch. Depending on your macOS version and state, you may see either:

- *"Crypto Tools.app" is damaged and can't be opened. You should move it to the Trash.*, or
- *Apple could not verify "Crypto Tools.app" is free of malware…*

Both mean the same thing: macOS is blocking an un-notarized, quarantined app. The app is safe to open.

**Easiest fix — install via Homebrew** (`brew install --cask nyg/tap/crypto-tools`), which strips the quarantine flag automatically.

**If you downloaded the DMG manually**, remove the quarantine flag once after copying the app to Applications:

```sh
xattr -dr com.apple.quarantine "/Applications/Crypto Tools.app"
```

Then double-click to launch. This works for **both** dialogs above.

Alternatively, for the *"could not verify"* dialog only, you can use the GUI path: open **System Settings → Privacy & Security**, scroll to the security section, click **Open Anyway**, then confirm. (This option is not offered for the *"damaged"* dialog — use the `xattr` command above instead.)

You only need to do this once per installation.

> The only way to make the app launch with no prompt at all is Apple **notarization**, which requires a paid Apple Developer account and is intentionally not used here.

### Windows SmartScreen

The app is **not code-signed** (it is not signed with a paid Authenticode / EV certificate). It is **not a virus** — but because it is unsigned and has no SmartScreen reputation, Windows blocks the first launch with:

- *Windows protected your PC — Microsoft Defender SmartScreen prevented an unrecognised app from starting.*

**Easiest fix — install via Scoop** (see [Desktop App](#desktop-app) for the `scoop bucket add` + `scoop install` commands), which downloads and extracts the app itself. Files extracted by Scoop don't carry the "mark of the web", so SmartScreen never fires — this works for standard (non-admin) users too.

**If you downloaded the ZIP manually**, after extracting it, click **More info → Run anyway** on the SmartScreen dialog.

> **Note:** the *More info → Run anyway* option is only offered to **administrator** accounts. Standard (non-admin) users get a hard block with no bypass when running the manually-downloaded installer — for those users, **Scoop is the only no-admin install path** (short of paid Windows code signing, which is intentionally not used here).

The app installs per-user to `%LOCALAPPDATA%` and never requires admin rights.

### Building the desktop app

```sh
bun run build:stable   # produces artifacts/ with .dmg (macOS) or .zip (Windows)
```

To run the desktop app locally without building a distributable:

```sh
bun run desktop:dev
```

## Development

### Prerequisites

- [Bun](https://bun.sh/) — runtime and package manager

### Installation

1. Clone the repository
   ```sh
   git clone https://github.com/nyg/crypto-tools.git
   cd crypto-tools
   ```
2. Install dependencies
   ```sh
   bun install
   ```
3. (Optional) Copy `.env.development.local.example` to `.env.development.local` and fill in your API keys
4. Start the development server
   ```sh
   bun run dev
   ```
5. Open http://localhost:3000

`bun run dev` starts both the Vite dev server (port 3000) and the Hono API server (port 3001) concurrently. Vite proxies `/api` requests to the Hono server.

### Network binding

Every listening socket the app opens is bound to `127.0.0.1`, so nothing is reachable from the local network and Windows Firewall never prompts on first launch.

Two of the three are ours: the Hono API in desktop mode (`src/electrobun/index.ts`) and in web mode (`src/server/index.js`, overridable with `HOST` for reverse-proxy or container deployments). The third belongs to Electrobun — it opens a WebSocket RPC server between the Bun process and the WebView on the first free port from 50000 upwards, and up to and including 1.18.1 it passes no `hostname` to `Bun.serve`, so Bun binds the wildcard address. On Windows that is what triggers *"Do you want to allow public and private networks to access this app?"* attributed to Bun (publisher Oven). `patches/electrobun@1.18.1.patch` adds the missing `hostname`; Bun applies it on `bun install` via `patchedDependencies` in `package.json`. Revisit the patch when upgrading Electrobun — 1.18.4 moves this socket into the native core, so it may become unnecessary or need reworking.

### Mocked Mode

Run the frontend only with mock data (no API keys or server required):

```sh
bun run mocked
```

This sets `VITE_MOCK_DATA=true`, which intercepts all API calls with a mock fetcher and auto-initializes `localStorage` with fake credentials. Useful for development and demos.

## Usage

The home page links to every tool; the top menu bar switches between exchanges and each exchange section has sub-navigation for its specific features.

API keys for Kraken, Binance, and Anthropic can be configured on the **Settings** page (stored in `localStorage`) or via environment variables (`VITE_*`).

Prefer a dedicated Kraken API key for this app. Kraken requires nonces to increase on every private call for a given key, so sharing one key between two applications making concurrent requests can make either of them fail with `EAPI:Invalid nonce`.

### Ledger storage

The Ledger page stores its data in a SQLite database in the per-user application data directory — `~/Library/Application Support/Crypto Tools` on macOS, `%APPDATA%\Crypto Tools` on Windows, `$XDG_DATA_HOME/crypto-tools` on Linux. A directory left behind by a version older than v0.1.2 (named `CryptoTools`) is moved across on first launch. Set `CRYPTO_TOOLS_DATA_DIR` to override it. `bun run dev` writes to `ledger-dev.db` so it never touches the installed app's data. Nothing is uploaded anywhere; deleting the file (or using **Clear data**) simply means the next sync downloads everything again.

## Project Structure

```
src/
├── electrobun/         Electrobun main process (TypeScript)
├── server/             Hono API server (runs on Bun)
│   ├── adapters/       External API adapters (Binance, Kraken, Anthropic)
│   │   └── http-requester/  HTTP transport abstraction
│   ├── db/             SQLite storage for the Kraken ledger (bun:sqlite)
│   ├── routes/         Hono route handlers (binance.js, kraken.js, kraken-ledger.js)
│   └── services/       Business logic (rate finder, Kraken ledger sync)
├── utils/              Shared utility functions (crypto, formatting, event bus)
└── views/              React frontend (built by Vite)
    ├── components/     React components
    │   ├── binance/    Binance-specific components
    │   ├── kraken/     Kraken-specific components
    │   ├── lib/        Custom wrapper components (NumericInput, SubNav, etc.)
    │   └── ui/         shadcn/ui primitives
    ├── lib/            Frontend utilities (cn)
    ├── mocks/          Mock data generators for development
    ├── pages/          Page-level React components
    │   ├── binance/
    │   └── kraken/
    └── styles/         Global stylesheet and theme tokens
```

## Disclaimer

Use at your own risk.

## License

[MIT](LICENSE)
