# Crypto Tools

A collection of cryptocurrency tools for [Kraken](https://www.kraken.com/) and [Binance](https://www.binance.com/) exchanges. Built with Vite, React, React Router, Hono, and Tailwind CSS.

## Features

### Kraken

- **Order Batch** — Create multiple buy or sell post-limit orders for a trading pair with configurable price and volume distribution functions. Supports dry-run mode for safe testing.
- **Closed Orders** — View and filter closed orders by asset and date range. Displays buy and sell orders grouped by trading pair with volume, cost, and average price summaries.
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
   - macOS: `CryptoTools.dmg`
   - Windows: `CryptoTools.zip`
2. **macOS**: open the DMG, drag **CryptoTools.app** to your **Applications** folder, then see [macOS Gatekeeper](#macos-gatekeeper) below before first launch
3. **Windows**: extract the ZIP and run **CryptoTools-Setup.exe** inside (installs per-user to `%LOCALAPPDATA%` — no admin rights). See [Windows SmartScreen](#windows-smartscreen) below before first launch.

API keys can be configured in the app on the **Settings** page (stored in `localStorage`).

### macOS Gatekeeper

The app is **ad-hoc signed but not notarized** (it is not signed with a paid Apple Developer certificate). It is **not damaged or corrupted** — but because it is not notarized, macOS quarantines it after download and blocks the first launch. Depending on your macOS version and state, you may see either:

- *"CryptoTools.app" is damaged and can't be opened. You should move it to the Trash.*, or
- *Apple could not verify "CryptoTools.app" is free of malware…*

Both mean the same thing: macOS is blocking an un-notarized, quarantined app. The app is safe to open.

**Easiest fix — install via Homebrew** (`brew install --cask nyg/tap/crypto-tools`), which strips the quarantine flag automatically.

**If you downloaded the DMG manually**, remove the quarantine flag once after copying the app to Applications:

```sh
xattr -dr com.apple.quarantine /Applications/CryptoTools.app
```

Then double-click to launch. This works for **both** dialogs above.

Alternatively, for the *"could not verify"* dialog only, you can use the GUI path: open **System Settings → Privacy & Security**, scroll to the security section, click **Open Anyway**, then confirm. (This option is not offered for the *"damaged"* dialog — use the `xattr` command above instead.)

You only need to do this once per installation.

> The only way to make the app launch with no prompt at all is Apple **notarization**, which requires a paid Apple Developer account and is intentionally not used here.

### Windows SmartScreen

The app is **not code-signed** (it is not signed with a paid Authenticode / EV certificate). It is **not a virus** — but because it is unsigned and has no SmartScreen reputation, Windows blocks the first launch with:

- *Windows protected your PC — Microsoft Defender SmartScreen prevented an unrecognised app from starting.*

**Easiest fix — install via Scoop** (`scoop install crypto-tools`), which downloads and extracts the app itself. Files extracted by Scoop don't carry the "mark of the web", so SmartScreen never fires — this works for standard (non-admin) users too.

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

### Mocked Mode

Run the frontend only with mock data (no API keys or server required):

```sh
bun run mocked
```

This sets `VITE_MOCK_DATA=true`, which intercepts all API calls with a mock fetcher and auto-initializes `localStorage` with fake credentials. Useful for development and demos.

## Usage

Navigate via the top menu bar to access each exchange's tools. Each exchange section has sub-navigation for its specific features.

API keys for Kraken, Binance, and Anthropic can be configured on the **Settings** page (stored in `localStorage`) or via environment variables (`VITE_*`).

## Project Structure

```
src/
├── electrobun/         Electrobun main process (TypeScript)
├── server/             Hono API server (runs on Bun)
│   ├── adapters/       External API adapters (Binance, Kraken, Anthropic)
│   │   └── http-requester/  HTTP transport abstraction
│   ├── routes/         Hono route handlers (binance.js, kraken.js)
│   └── services/       Business logic (rate finder using Dijkstra's algorithm)
├── utils/              Shared utility functions (crypto, formatting, event bus)
└── views/              React frontend (built by Vite)
    ├── components/     React components
    │   ├── binance/    Binance-specific components
    │   ├── kraken/     Kraken-specific components
    │   ├── lib/        Custom wrapper components (NumericInput, Select, etc.)
    │   └── ui/         shadcn/ui primitives
    ├── mocks/          Mock data generators for development
    └── pages/          Page-level React components
        ├── binance/
        └── kraken/
```

## Disclaimer

Use at your own risk.

## License

[MIT](LICENSE)
