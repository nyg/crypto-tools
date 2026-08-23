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

No test framework is configured.

## README screenshots

Every screenshot in `public/` is a 2247px-wide PNG: the page on a transparent background with a 44px margin, rounded corners and a drop shadow. Retake one so it matches the others:

1. **Serve the fixture, never real data.** Port 3000 is usually a real `bun run dev`, whose Vite proxies `/api` to the Hono server and your actual Kraken database. Start a separate mocked instance instead — `VITE_MOCK_DATA=true ./node_modules/.bin/vite --port 3100` — and confirm it is the mocked one: in mocked mode the app makes no `/api` network requests at all, because the SWR fetcher answers from `src/views/mocks/`.
2. **Capture with headless Chrome over CDP.** Launch `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --headless=new --remote-debugging-port=9333 --user-data-dir=<tmp> --allow-file-access-from-files`, connect to the page target's `webSocketDebuggerUrl`, then: `Emulation.setDeviceMetricsOverride` with `deviceScaleFactor: 1` and a viewport wide enough that no table scrolls horizontally (1440 works for the widest page); `Page.navigate`; `Runtime.evaluate` to seed whatever `localStorage` the page needs to show something worth looking at; `Page.getLayoutMetrics` for `cssContentSize`; and `Page.captureScreenshot` with `captureBeyondViewport: true` and `clip.scale: 2` for the full page at 2x.
3. **Composite the frame on a canvas**, in the same headless Chrome. Scale the capture to 2159px wide, place it at (44, 44) on a 2247px-wide canvas whose height is the scaled height plus 88, and clip it to a `roundRect` of radius 14. Cast the shadow by filling that same path first with `shadowColor = 'rgba(15, 23, 42, 0.28)'`, `shadowBlur = 40`, `shadowOffsetY = 14`. Export with `toDataURL('image/png')`.

The shadow numbers are not arbitrary — they were measured off the existing screenshots' alpha channel, and reproduce their falloff to within a couple of levels of 255. Check a new capture against `public/screenshot-kraken-open-orders.png` before committing it.

## Architecture

This is a **Vite + React Router + Hono** app providing cryptocurrency tools for Binance and Kraken exchanges, plus AI-powered asset classification via Anthropic. The desktop app is built with **[Electrobun](https://electrobun.dev/)**.

The project is split into two runtime targets:

- **`src/views/`** — React frontend, built by Vite, served on port 3000 in dev
- **`src/server/`** — Hono API server, run by Bun, served on port 3001 in dev

Vite proxies all `/api/*` requests to the Hono server during development. In production (web), the Hono server serves the built frontend as static files. In the desktop app (Electrobun), the Hono server runs in the Electrobun main process and the frontend is loaded from `views://main/index.html`.

### Layers

**Pages** (`src/views/pages/`) — React Router route components. Each exchange has its own subdirectory (`binance/`, `kraken/`). `settings.jsx` handles API key management.

**Components** (`src/views/components/`) — exchange-specific components live in `components/binance/` and `components/kraken/`. Custom wrapper components (NumericInput, Checkbox, Select, DateField, etc.) live in `components/lib/` and wrap the shadcn/ui primitives in `components/ui/`. shadcn/ui is configured with `rsc: false`, `tsx: false`, and `radix-nova` style.

**Adapters** (`src/server/adapters/`) — each external API has an adapter directory (`binance-api/`, `binance-gateway-api/`, `kraken-api/`, `anthropic/`) following a three-layer pattern:
- `adapter.ts` — public interface with domain methods (constructor function, default export)
- `resource.ts` — raw HTTP endpoint calls (named exports)
- `authenticator.ts` — request signing as a higher-order function: `authenticator(credentials)` returns `async (request) => signedRequest`

A single HTTP requester (`src/server/adapters/http-requester/server-http-requester.ts`) abstracts the transport layer using Bun's native `fetch`. It exports `httpRequester` as a pre-instantiated singleton.

**Routes** (`src/server/routes/`) — Hono route handlers, one file per exchange (`binance.ts`, `kraken.ts`). Each route destructures credentials from the request body, validates they exist (401 if missing), instantiates the appropriate adapter, and returns JSON. Sub-routers are mounted from within their exchange's file (`kraken.ts` mounts `kraken-ledger.ts` at `/ledger`) rather than in the server entry points, because `app.ts` and `index.ts` each declare their own route table and only one of them runs in a given environment.

**Database** (`src/server/db/`) — SQLite storage for the Kraken ledger via `bun:sqlite`. `paths.ts` resolves a per-user OS application data directory (never a cwd-relative path: the desktop app launches from Finder, where `process.cwd()` is `/`). `database.ts` opens a lazy singleton and applies `PRAGMA user_version`-based migrations. `ledger-repository.ts` is a constructor function scoped to one `account_id`, derived from a hash of the API key so that several Kraken accounts can be stored side by side. Amounts are stored as the exact decimal strings the API returned, never as floats or via `Big`, which would rewrite small values in exponential notation.

**Services** (`src/server/services/`) — `rate-finder.ts` uses Dijkstra's algorithm (`modern-dijkstra`) to find trading pair paths and calculate fiat rates against USDT. `kraken-ledger-sync.ts` runs the multi-step ledger export as a background job held in an in-memory registry keyed by account, which the page follows by polling a status endpoint.

**Utils** (`src/utils/`) — browser-side helpers shared by the views. `format.js` provides locale formatting via `Intl`, reading the locale list from `locale.js`, which prefers the one the Electrobun main process injects as `window.__LOCALES__` and falls back to the navigator's.

**Types** (`src/types/`) — the third runtime target, imported by both of the others and shipping no code of its own. It holds the exchange payload shapes the adapters parse, the SQLite row shapes the repositories read, and — the point of the directory — the API response shapes, so a route and the page that reads it are checked against the same declaration. `index.ts` re-exports the lot for anything that wants one import.

**Electrobun main process** (`src/electrobun/index.ts`) — TypeScript entry point for the desktop app. Starts the Hono server on an OS-assigned port (port 3001 only when it attaches to the Vite dev server, whose proxy needs a fixed target) and injects that port into the page as `window.__API_PORT__`, opens a `BrowserWindow`, and wires up menus and external link handling.

The SDK is imported from `electrobun/main` and comes from `.hutch/devkit`, not `node_modules`: the `electrobun` npm package is a bootstrap that downloads and caches the paired Hutch toolchain, and `tsconfig.json` maps the import specifiers into the projected devkit. The build channel is read with `BuildConfig.getSync().channel`; `app.channel` is a different thing in Electrobun 2 and is always empty here. Build hooks (`scripts/prebuild.ts`, `scripts/postwrap.ts`) run under Cottontail rather than Bun, so they shell out with `node:child_process` instead of importing from `bun`.

### Data Flow

1. Pages fetch data via SWR. Public/read-only data uses `useSWR` (auto-fetch); authenticated operations use `useSWRMutation` (manual trigger).
2. The global SWR fetcher in `src/views/app.jsx` accepts either a string key or an `[url, body]` array key, and POSTs whenever a body is present (from the array key, or from `params.arg` for `useSWRMutation`). Array keys are how a `useSWR` call — which never receives an `arg` — can still send credentials in a request body.
3. Hono route handlers destructure credentials from `req.body.credentials`, validate they exist (401 if missing), instantiate the appropriate adapter, and return JSON.
4. API keys are stored in `localStorage` per provider (e.g. `binance.api.key`, `kraken.api.secret`) with fallback to `VITE_*` env vars. Always guard localStorage access with `typeof window !== 'undefined'`.

### AI Integration

`src/server/adapters/anthropic/adapter.ts` uses Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) with Zod-validated structured output to classify Kraken tokenized assets as stock/ETF/unknown. Called from the `/api/kraken/xstocks` Hono route.

### Mocked Mode

The app supports a mocked mode for development and demos, activated via `bun run mocked` or `VITE_MOCK_DATA=true`. In `src/views/app.jsx`, the global SWR fetcher checks this env var and routes all API calls through `mockFetcher()` from `src/views/mocks/index.js` instead of making real HTTP requests. Mock data generators live in `src/views/mocks/` with per-exchange files (`kraken.js`, `binance.js`). On startup, `initMockCredentials()` auto-populates `localStorage` with fake API keys so authenticated features work without configuration.

## Code Conventions

- **3-space indentation**, no semicolons, single quotes (enforced by ESLint; `react-hooks/exhaustive-deps` is disabled)
- **Styling**: Tailwind CSS v4 + shadcn/ui components — no custom CSS
- **Precision math**: use `big.js` for all numeric calculations involving asset amounts or rates
- **ES6 classes** for the adapters, repositories and other stateful services (e.g. `export default class BinanceAPI { constructor(credentials) { … } }`), with `#private` fields for what used to be closure state. TypeScript cannot infer a construct signature from `this.x = …` in a plain function, so the constructor-function style this codebase used before the TypeScript migration typed every `new` expression as `any`. Everything stateless stays a plain function.
- **Functional React components** with hooks; no class components, no global state libraries
- TypeScript throughout, checked under `strict`. `src/server`, `src/types` and `src/electrobun` are `.ts`; React components will be `.tsx`. No `any` in application code — external JSON enters as a declared interface at the adapter or route boundary, and `unknown` plus narrowing covers anything genuinely dynamic. (`src/views` and `src/utils` are still `.js`/`.jsx` until their own migration PRs land.)
- Relative imports carry no file extension, so Bun, Vite and `tsc` all resolve them the same way
- A caught value is `unknown`: use `messageOf(error)` from `src/server/errors.ts` to print one, and `instanceof HttpRequesterError` to tell an exchange's refusal apart from a bug
- **Path alias**: `@/*` maps to `src/views/` (configured in `tsconfig.json` and `vite.config.ts`)
- **Class merging**: use `cn()` from `src/views/lib/utils.js` (`clsx` + `tailwind-merge`) for conditional Tailwind classes

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

