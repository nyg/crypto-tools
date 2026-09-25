# Agent Instructions

## Build & Run

- **Package manager / runtime**: bun
- **Dev server**: `bun run dev` (starts Vite dev server on port 3000 + Hono API server on port 3001 via `concurrently`)
- **Mocked mode**: `bun run mocked` (sets `VITE_MOCK_DATA=true`, Vite-only — no API keys or server required)
- **Build (frontend)**: `bun run build`
- **Build (desktop app)**: `bun run build:stable`
- **Prepare the Electrobun devkit**: `bun run desktop:prepare` (projects the main-process SDK into `.hutch/devkit`; `desktop:dev`, `build:stable` and `typecheck` do it implicitly, but an editor or a bare `tsc` needs it once on a fresh checkout)
- **Lint**: `bun run lint` (ESLint + typescript-eslint)
- **Type-check**: `bun run typecheck` (`tsc --noEmit` over `src`, `scripts` and `electrobun.config.ts`)

### Two TypeScript packages, on purpose

`typescript-eslint` cannot run against the TypeScript 7 compiler API ([typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940)), so `package.json` uses the side-by-side layout TypeScript 7 documents: `@typescript/native` is an alias of `typescript@7` and provides the `tsc` binary that `bun run typecheck` runs, while `typescript` is an alias of `@typescript/typescript6` and provides the TS 6 API that ESLint imports (its own binary is named `tsc6`, so the two never collide). Type checking is therefore TypeScript 7; only the linter's parser is TypeScript 6. Collapse this back to a single `typescript` dependency once typescript-eslint supports TS 7.

**Test**: `bun run test` (`bun test`). `src/server/secrets.test.ts` drives the credential store through child processes — the modules hold process-wide state, and the data directory is read at import time. `CRYPTO_TOOLS_DATA_DIR` and `CRYPTO_TOOLS_KEYCHAIN_SERVICE` are what keep a run off your real keys. The store-backed cases skip themselves on a host with no secret service, which is why CI runs the suite on Windows as well as Ubuntu. `src/server/services/portfolio/portfolio-core.test.ts` covers the pure planner, holdings fold and target validation; `portfolio-service.test.ts` runs the portfolio service end to end against a fake exchange and a database in a temporary `CRYPTO_TOOLS_DATA_DIR`, set before the first `getDatabase()` call. `src/server/adapters/kraken-api/spot.test.ts` and `binance-api/spot.test.ts` pin the pure mappers from each exchange's payloads to the portfolio shapes. `src/server/adapters/kraken-api/earn.test.ts` pins how Earn allocations and strategies split a live Kraken balance into the placements the Balances page shows. `src/server/db/ledger-repository.test.ts` pins how the Rewards page's monthly and weekly buckets fall: UTC months, weeks starting on Monday, the last twelve and fifty-two of them.

## README screenshots

Every screenshot in `public/` is a 2247px-wide PNG: the page on a transparent background with a 44px margin, rounded corners and a drop shadow. Retake one so it matches the others:

1. **Serve the fixture, never real data.** Port 3000 is usually a real `bun run dev`, whose Vite proxies `/api` to the Hono server and your actual Kraken database. Start a separate mocked instance instead — `VITE_MOCK_DATA=true ./node_modules/.bin/vite --port 3100` — and confirm it is the mocked one: in mocked mode the app makes no `/api` network requests at all, because the SWR fetcher answers from `src/views/mocks/`.
2. **Capture with headless Chrome over CDP.** Launch `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --headless=new --remote-debugging-port=9333 --user-data-dir=<tmp> --allow-file-access-from-files`, connect to the page target's `webSocketDebuggerUrl`, then: `Emulation.setDeviceMetricsOverride` with `deviceScaleFactor: 1` and a viewport wide enough that no table scrolls horizontally (1440 works for the widest page); `Emulation.setEmulatedMedia` with `prefers-color-scheme: light`, since the app follows the OS appearance and every screenshot is in light mode; `Page.navigate`; `Runtime.evaluate` to seed whatever `localStorage` the page needs to show something worth looking at; `Page.getLayoutMetrics` for `cssContentSize`; and `Page.captureScreenshot` with `captureBeyondViewport: true` and `clip.scale: 2` for the full page at 2x.
3. **Composite the frame on a canvas**, in the same headless Chrome. Scale the capture to 2159px wide, place it at (44, 44) on a 2247px-wide canvas whose height is the scaled height plus 88, and clip it to a `roundRect` of radius 14. Cast the shadow by filling that same path first with `shadowColor = 'rgba(15, 23, 42, 0.28)'`, `shadowBlur = 40`, `shadowOffsetY = 14`. Export with `toDataURL('image/png')`.

The shadow numbers are not arbitrary — they were measured off the existing screenshots' alpha channel, and reproduce their falloff to within a couple of levels of 255. Check a new capture against `public/screenshot-kraken-open-orders.png` before committing it.

## Architecture

This is a **Vite + React Router + Hono** app providing cryptocurrency tools for Binance, Kraken and Bybit exchanges, plus AI-powered asset classification via Anthropic. The desktop app is built with **[Electrobun](https://electrobun.dev/)**.

The project is split into two runtime targets:

- **`src/views/`** — React frontend, built by Vite, served on port 3000 in dev
- **`src/server/`** — Hono API server, run by Bun, served on port 3001 in dev

Vite proxies all `/api/*` requests to the Hono server during development. In production (web), the Hono server serves the built frontend as static files. In the desktop app (Electrobun), the Hono server runs in the Electrobun main process and the frontend is loaded from `views://main/index.html`.

### Layers

**Pages** (`src/views/pages/`) — React Router route components. Each exchange has its own subdirectory (`binance/`, `bybit/`, `kraken/`). API keys are managed per exchange: each subdirectory's `settings.tsx` renders `components/settings/settings-page.tsx` with the providers its tabs need, which `src/views/lib/tools.ts` declares beside the tabs themselves (Kraken also carries Anthropic, for xStocks). The header link of each exchange opens the tab last visited in it, remembered by `src/views/lib/last-tab.ts` in `localStorage`. A page names the response type it expects on each `useSWR`/`useMutation` call, which is what checks it against the route that serves it.

**Components** (`src/views/components/`) — exchange-specific components live in `components/binance/` and `components/kraken/`. Custom wrapper components (NumericInput, Checkbox, Select, DateField, etc.) live in `components/lib/` and wrap the shadcn/ui primitives in `components/ui/`. shadcn/ui is configured with `rsc: false`, `tsx: true`, and `radix-nova` style.

**Theme** — the app is light or dark as the OS is, until the toggle in the header picks the other one. `src/views/lib/theme.ts` keeps that choice under `ui.theme` in `localStorage` only while it differs from the OS: toggling back to the OS's appearance removes the key, and the app follows the OS again. It flips the `.dark` class on `<html>`, which the tokens in `styles/global.css` and every `dark:` variant key off. An inline script in `index.html` applies the same rule before the stylesheet loads, so no page paints in the wrong theme first; change the key or the rule in both places. Anything that bakes a theme in when it is created, like the TradingView widget or Sonner's toaster, reads `useTheme()` instead of the class, so it follows a change.

**Adapters** (`src/server/adapters/`) — each external API has an adapter directory (`binance-api/`, `binance-gateway-api/`, `bybit-api/`, `kraken-api/`, `anthropic/`) following a three-layer pattern:
- `adapter.ts` — public interface with domain methods (constructor function, default export)
- `resource.ts` — raw HTTP endpoint calls (named exports)
- `authenticator.ts` — request signing as a higher-order function: `authenticator(credentials)` returns `async (request) => signedRequest`

A single HTTP requester (`src/server/adapters/http-requester/server-http-requester.ts`) abstracts the transport layer using Bun's native `fetch`. It exports `httpRequester` as a pre-instantiated singleton.

**Routes** (`src/server/routes/`) — Hono route handlers, one file per exchange (`binance.ts`, `bybit.ts`, `kraken.ts`). Each route destructures credentials from the request body, validates they exist (401 if missing), instantiates the appropriate adapter, and returns JSON. Sub-routers are mounted from within their exchange's file (`kraken.ts` mounts `kraken-ledger.ts` at `/ledger`) rather than in the server entry points, because `app.ts` and `index.ts` each declare their own route table and only one of them runs in a given environment. `portfolios.ts` is a factory rather than a router: `bybit.ts` mounts `portfolioRoutes('bybit')` at `/portfolios` and `portfolioRoutes('bybitDemo')` at `/demo/portfolios`, `kraken.ts` mounts `portfolioRoutes('kraken')` at `/portfolios`, and `binance.ts` mounts `portfolioRoutes('binance')` and `portfolioRoutes('binanceTestnet')` at `/portfolios` and `/testnet/portfolios`. Its ids travel in the request body, never the path, because the mock fetcher matches exact URLs.

**Database** (`src/server/db/`) — SQLite storage for the Kraken ledger via `bun:sqlite`. `paths.ts` resolves a per-user OS application data directory (never a cwd-relative path: the desktop app launches from Finder, where `process.cwd()` is `/`). `database.ts` opens a lazy singleton and applies `PRAGMA user_version`-based migrations. `ledger-repository.ts` is a constructor function scoped to one `account_id`, derived from a hash of the API key so that several Kraken accounts can be stored side by side. Amounts are stored as the exact decimal strings the API returned, never as floats or via `Big`, which would rewrite small values in exponential notation.

**Portfolios** (`src/server/services/portfolio/`) — virtual portfolios, several per exchange account. A portfolio owns only what its own `portfolio_movement` rows (deposits, withdrawals, adjustments, fees) and `portfolio_order` fills add up to, folded with `Big` in `holdings.ts`, and the same rows fold again in `positions.ts` into an average cost per coin, from which each holding's realized and unrealized profit follow — they add up to the portfolio's value less its net deposits, which is the check to keep when changing either fold; whatever no portfolio holds is the account's unallocated balance, and trades made outside the app never change a portfolio. `planner.ts` is pure: holdings, targets and market limits in, rounded market orders out, sells before buys. `portfolio-service.ts` keeps each preview in memory for two minutes under a `planId`, and `execute` refuses a preview whose holdings or prices have moved since; it writes the run and every order row before placing anything, runs them detached, and records each fill as it settles, so `overview` can reconcile a run the server stopped in the middle of by each order's `orderLinkId`. Stops are the one thing that lives on the exchange: a target's optional `stop_price` becomes a resting stop-market sell (Bybit `orderFilter=StopOrder`, Kraken `stop-loss`, Binance `STOP_LOSS`), sized and diffed by the pure `stops.ts` and recorded in `portfolio_stop`. Bybit's reserves nothing until it triggers; Kraken's and Binance's lock the coin, so `Venue.stopsReserve` makes `plan` count the portfolio's own resting stops as free, since `#run` cancels them before it sells. `#syncStops` places and cancels through a per-account promise chain, `#run` cancels before it trades and places again in its `finally`, and `#reconcile` turns a fill into an ordinary `portfolio_order` row under a run of kind `stop`, then moves the coin's weight to cash with `moveWeightToCash`. `Venue.hardStops` turns the whole thing off for a venue that refuses conditional orders. Everything exchange-specific sits behind `PortfolioExchange` in `exchange.ts`, including how to read the exchange's error bodies (`describeError`, `isAmbiguous`) and how to find an order again from an `OrderLookup` (symbol, client id and exchange id, since Binance needs the symbol and Kraken answers fastest by txid). Kraken takes a buy's fee from the cash, on top of what the order spends, where Bybit and Binance take it from the coin bought: `buyFeeInQuote` makes `planPortfolio` and `#placeBuys` shrink the buy budget by the fee so the portfolio's cash never goes below zero, at the taker rate `takerFeeRate` reads from Kraken's `TradeVolume` for the portfolio's pairs, or `DEFAULT_FEE_RATE` on an exchange that doesn't implement it. `bybit-exchange.ts`, `kraken-exchange.ts` and `binance-exchange.ts` implement it, over the pure payload mappers in each adapter's `spot.ts`, and `venues.ts` maps a venue to its provider, cash coins, valuation coin and factory. The Bybit account id is the `userID` of the key and the Binance one its `uid`, so rotating a key keeps the portfolios; Kraken exposes no account id, so it reuses `krakenAccountId()`, the same id that partitions the ledger. Kraken's free-text `cl_ord_id` is at most 18 characters, which the `pf{id}-{run}-{seq}` order ids fit up to four-digit portfolio ids. Bybit market data is always read from mainnet, because demo trading follows mainnet prices; the Binance testnet has its own book, so its market data comes from the testnet. On the page side, `components/portfolio/portfolios-page.tsx` is the whole page, and each exchange's `pages/*/portfolios.tsx` only lists its venues.

**Services** (`src/server/services/`) — `rate-finder.ts` uses Dijkstra's algorithm (`modern-dijkstra`) to find trading pair paths and calculate fiat rates against USDT. `kraken-ledger-sync.ts` runs the multi-step ledger export as a background job held in an in-memory registry keyed by account, which the page follows by polling a status endpoint.

**Utils** (`src/utils/`) — browser-side helpers shared by the views. `format.ts` provides locale formatting via `Intl`, reading the locale list from `locale.ts`, which prefers the one the Electrobun main process injects as `window.__LOCALES__` and falls back to the navigator's.

**Types** (`src/types/`) — the third runtime target, imported by both of the others and shipping no code of its own. It holds the exchange payload shapes the adapters parse, the SQLite row shapes the repositories read, and — the point of the directory — the API response shapes, so a route and the page that reads it are checked against the same declaration. `index.ts` re-exports the lot for anything that wants one import.

**Electrobun main process** (`src/electrobun/index.ts`) — TypeScript entry point for the desktop app. Starts the Hono server on an OS-assigned port (port 3001 only when it attaches to the Vite dev server, whose proxy needs a fixed target) and injects that port into the page as `window.__API_PORT__`, opens a `BrowserWindow`, and wires up menus and external link handling. On macOS the window uses `titleBarStyle: 'hiddenInset'`, so there is no native title bar: the page's header takes its place and follows the app's theme. The preload sets `window.__INSET_TITLEBAR__`, which makes `components/layout.tsx` pad the header's first row clear of the traffic lights and turn it into an `electrobun-webkit-app-region-drag` region, with its links and buttons marked `no-drag`. `setWindowButtonPosition(20, 20)` centres the 16pt-tall buttons in that 56px row, so change the two together. In full screen the traffic lights are hidden, so `src/electrobun/title-bar.ts` reports the window's full-screen state to the page on every resize and on `dom-ready`, and `useFullScreen()` from `src/views/lib/title-bar.ts` drops the padding and the drag region for as long as it lasts. Electrobun moves the window itself instead of handing the drag to AppKit, so a double-click on that row does nothing natively: the page sends it to the main process through `window.__electrobunSendToHost`, which applies the user's `AppleActionOnDoubleClick` setting — minimize, zoom (which also stands in for Fill), or nothing.

The SDK is imported from `electrobun/main` and comes from `.hutch/devkit`, not `node_modules`: the `electrobun` npm package is a bootstrap that downloads and caches the paired Hutch toolchain, and `tsconfig.json` maps the import specifiers into the projected devkit. The build channel is read with `BuildConfig.getSync().channel`; `app.channel` is a different thing in Electrobun 2 and is always empty here. Build hooks (`scripts/prebuild.ts`, `scripts/postwrap.ts`) run under Cottontail rather than Bun, so they shell out with `node:child_process` instead of importing from `bun`.

### Data Flow

1. Pages fetch data via SWR. Public/read-only data uses `useSWR` (auto-fetch); authenticated operations use `useMutation` from `src/views/lib/use-mutation.ts` (manual trigger), a thin wrapper over `useSWRMutation` that passes the shared fetcher explicitly — SWR's types demand a fetcher argument even though the hook falls back to the configured one.
2. The global SWR fetcher lives in `src/views/lib/fetcher.ts` and is handed to `SWRConfig` by `app.tsx`. It accepts either a string key or an `[url, body]` array key, and POSTs whenever a body is present (from the array key, or from `params.arg` for a mutation). Array keys are how a `useSWR` call — which never receives an `arg` — can still send a request body.
3. Hono route handlers wrap themselves in `withCredentials` or `withAccount` from `src/server/routes/with-account.ts`, which read the credentials server-side and answer 401 when there are none. The browser never sends a key.

### Credentials

API keys live in the OS credential store — Keychain on macOS, Credential Manager on Windows, libsecret on Linux — reached through `Bun.secrets` in `src/server/secrets.ts`, the only module that touches it. Read order per secret is environment, then the store, then `settings.json` as a fallback. A store that refuses a write is not an error: the value goes to the 0600 file instead, and the Settings tab says so rather than implying otherwise. `src/server/settings.ts` owns that file and knows nothing about the store.

Environment variables win only where an entry point asks for it. `allowEnvironmentOverrides()` in `src/server/environment.ts` is called by `src/server/index.ts` and deliberately not by `src/electrobun/index.ts`, because a packaged build launched from a terminal inherits whatever the shell exports and runs with `NODE_ENV` unset. A provider id is snake-cased into its variable names, so `bybitDemo` reads `BYBIT_DEMO_API_KEY` and `BYBIT_DEMO_API_SECRET`, and `binanceTestnet` reads `BINANCE_TESTNET_API_KEY` and `BINANCE_TESTNET_API_SECRET`.

`kraken.accountId` stays in `settings.json`: it partitions the ledger database rather than authenticating anything, which is what lets `krakenAccountId()` stay synchronous and keeps the read-only ledger routes off the credential store — and its prompt — on every request. It survives a key rotation on purpose, since deriving a fresh one would orphan every synced row.

The macOS keychain identity is the bundled `bun` binary, not the app bundle ([oven-sh/bun#28071](https://github.com/oven-sh/bun/issues/28071)). Shipping new JavaScript does not re-prompt; a release that bumps the bundled Bun version does, once. `bun run dev` runs your own Bun against a `.dev`-suffixed service, so it gets its own entry and its own prompt.

### AI Integration

`src/server/adapters/anthropic/adapter.ts` uses Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) with Zod-validated structured output to classify Kraken tokenized assets as stock/ETF/unknown. Called from the `/api/kraken/xstocks` Hono route.

Claude only sees the tickers the checked-in reference data does not cover. `scripts/refresh-xstocks.ts` builds that data. It types and names new Kraken tickers from the Nasdaq Trader symbol directory into `src/server/data/xstocks.json`. It rebuilds `src/server/data/xstock-products.json`: the ISINs come from the xStocks API, and the product page slugs from the assets.backed.fi product list. A slug the list doesn't have is kept from the last run, or else read from the address printed on the xStock's factsheet PDF. The factsheet matches the list for every published page, and it names the page before Backed publishes it. assets.backed.fi redirects US visitors to `/geoblock`, GitHub's runners included, so the list is skipped there. `nameOverrides` and `subtypeOverrides` apply to every entry on each run. A file whose content has not changed is left as it is, `generatedAt` included. `.github/workflows/refresh-xstocks.yml` runs the script every Monday and opens a pull request from `chore/refresh-xstocks` when either file changed. It uses `RELEASE_TOKEN`, because a pull request opened with `GITHUB_TOKEN` would never get the CodeQL checks the `master` ruleset requires. A pull request that touches the script or the workflow runs it too, without opening one.

### Mocked Mode

The app supports a mocked mode for development and demos, activated via `bun run mocked` or `VITE_MOCK_DATA=true`. The fetcher in `src/views/lib/fetcher.ts` checks this env var and routes all API calls through `mockFetcher()` from `src/views/mocks/index.ts` instead of making real HTTP requests. Mock data generators live in `src/views/mocks/` with per-exchange files (`kraken.ts`, `binance.ts`). Each one declares the response type from `src/types/api.ts` that the route it stands in for returns, so a mock that drifts from the real shape is a compile error rather than a page that only breaks under mocked mode.

## Code Conventions

- **3-space indentation**, no semicolons, single quotes (enforced by ESLint; `react-hooks/exhaustive-deps` is disabled)
- **Styling**: Tailwind CSS v4 + shadcn/ui components — no custom CSS
- **Precision math**: use `big.js` for all numeric calculations involving asset amounts or rates
- **ES6 classes** for the adapters, repositories and other stateful services (e.g. `export default class BinanceAPI { constructor(credentials) { … } }`), with `#private` fields for what used to be closure state. TypeScript cannot infer a construct signature from `this.x = …` in a plain function, so the constructor-function style this codebase used before the TypeScript migration typed every `new` expression as `any`. Everything stateless stays a plain function.
- **Functional React components** with hooks; no class components, no global state libraries
- TypeScript throughout, checked under `strict` with `allowJs` off — there is no JavaScript left under `src`. React components are `.tsx`, everything else `.ts`. No `any` in application code: external JSON enters as a declared interface at the adapter or route boundary, and `unknown` plus narrowing covers anything genuinely dynamic.
- Relative imports carry no file extension, so Bun, Vite and `tsc` all resolve them the same way
- A caught value is `unknown`: use `messageOf(error)` from `src/server/errors.ts` to print one, and `instanceof HttpRequesterError` to tell an exchange's refusal apart from a bug
- **Path alias**: `@/*` maps to `src/views/` (configured in `tsconfig.json` and `vite.config.ts`)
- **Class merging**: use `cn()` from `src/views/lib/utils.ts` (`clsx` + `tailwind-merge`) for conditional Tailwind classes

## Branching workflow

- Never commit directly to `master`. Always open a pull request against `master`.
- If the current branch is not `master`, do work on that branch.
- If the current branch is `master`, create a new feature branch before making any changes.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <description>
```

Common types: `feat`, `fix`, `chore`, `docs`, `refactor`, `ci`, `perf`, `build`, `revert`.

- `feat`: new feature or capability
- `fix`: bug fix
- `chore`: maintenance (deps, config, tooling)
- `docs`: documentation only
- `refactor`: code change with no behaviour change
- `ci`: CI/CD workflow changes
- `build`: changes to build system (electrobun.config.ts, vite.config.js, etc.)

