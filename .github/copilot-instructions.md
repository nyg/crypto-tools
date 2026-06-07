# Copilot Instructions

## Build & Run

- **Package manager / runtime**: bun
- **Dev server**: `bun run dev` (starts Vite dev server on port 3000 + Hono API server on port 3001 via `concurrently`)
- **Mocked mode**: `bun run mocked` (sets `VITE_MOCK_DATA=true`, Vite-only — no API keys or server required)
- **Build (frontend)**: `bun run build`
- **Build (desktop app)**: `bun run build:stable`
- **Lint**: `bun run lint` (ESLint)

No test framework is configured.

## Architecture

This is a **Vite + React Router + Hono** app providing cryptocurrency tools for Binance and Kraken exchanges, plus AI-powered asset classification via Anthropic. The desktop app is built with **[Electrobun](https://electrobun.dev/)**.

The project is split into two runtime targets:

- **`src/views/`** — React frontend, built by Vite, served on port 3000 in dev
- **`src/server/`** — Hono API server, run by Bun, served on port 3001 in dev

Vite proxies all `/api/*` requests to the Hono server during development. In production (web), the Hono server serves the built frontend as static files. In the desktop app (Electrobun), the Hono server runs in the Electrobun main process and the frontend is loaded from `views://main/index.html`.

### Layers

**Pages** (`src/views/pages/`) — React Router route components. Each exchange has its own subdirectory (`binance/`, `kraken/`). `settings.jsx` handles API key management.

**Components** (`src/views/components/`) — exchange-specific components live in `components/binance/` and `components/kraken/`. Custom wrapper components (NumericInput, Checkbox, Select, DatePicker, etc.) live in `components/lib/` and wrap the shadcn/ui primitives in `components/ui/`. shadcn/ui is configured with `rsc: false`, `tsx: false`, and `radix-nova` style.

**Adapters** (`src/server/adapters/`) — each external API has an adapter directory (`binance-api/`, `binance-gateway-api/`, `kraken-api/`, `anthropic/`) following a three-layer pattern:
- `adapter.js` — public interface with domain methods (constructor function, default export)
- `resource.js` — raw HTTP endpoint calls (named exports)
- `authenticator.js` — request signing as a higher-order function: `authenticator(credentials)` returns `async (request) => signedRequest`

A single HTTP requester (`src/server/adapters/http-requester/server-http-requester.js`) abstracts the transport layer using Bun's native `fetch`. It exports `httpRequester` as a pre-instantiated singleton.

**Routes** (`src/server/routes/`) — Hono route handlers, one file per exchange (`binance.js`, `kraken.js`). Each route destructures credentials from the request body, validates they exist (401 if missing), instantiates the appropriate adapter, and returns JSON.

**Services** (`src/server/services/`) — `rate-finder.js` uses Dijkstra's algorithm (`modern-dijkstra`) to find trading pair paths and calculate fiat rates against USDT.

**Utils** (`src/utils/`) — `crypto.js` wraps Web Crypto API using higher-order factory functions (`hash(algo)`, `hmac(algo)`) that export `sha256`, `hmacSha256`, `hmacSha512`. `format.js` provides en-GB locale formatting via `Intl`. `event-bus.js` is a DOM-based pub/sub (SSR-safe, returns cleanup functions for `useEffect`).

**Electrobun main process** (`src/electrobun/index.ts`) — TypeScript entry point for the desktop app. Starts the Hono server on port 3001, opens a `BrowserWindow`, and wires up menus and external link handling.

### Data Flow

1. Pages fetch data via SWR. Public/read-only data uses `useSWR` (auto-fetch); authenticated operations use `useSWRMutation` (manual trigger).
2. The global SWR fetcher in `src/views/app.jsx` routes GET vs POST based on the presence of `params.arg`.
3. Hono route handlers destructure credentials from `req.body.credentials`, validate they exist (401 if missing), instantiate the appropriate adapter, and return JSON.
4. API keys are stored in `localStorage` per provider (e.g. `binance.api.key`, `kraken.api.secret`) with fallback to `VITE_*` env vars. Always guard localStorage access with `typeof window !== 'undefined'`.

### AI Integration

`src/server/adapters/anthropic/adapter.js` uses Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) with Zod-validated structured output to classify Kraken tokenized assets as stock/ETF/unknown. Called from the `/api/kraken/xstocks` Hono route.

### Mocked Mode

The app supports a mocked mode for development and demos, activated via `bun run mocked` or `VITE_MOCK_DATA=true`. In `src/views/app.jsx`, the global SWR fetcher checks this env var and routes all API calls through `mockFetcher()` from `src/views/mocks/index.js` instead of making real HTTP requests. Mock data generators live in `src/views/mocks/` with per-exchange files (`kraken.js`, `binance.js`). On startup, `initMockCredentials()` auto-populates `localStorage` with fake API keys so authenticated features work without configuration.

## Code Conventions

- **3-space indentation**, no semicolons, single quotes (enforced by ESLint; `react-hooks/exhaustive-deps` is disabled)
- **Styling**: Tailwind CSS v4 + shadcn/ui components — no custom CSS
- **Precision math**: use `big.js` for all numeric calculations involving asset amounts or rates
- **Constructor functions** over ES6 classes (e.g. `export default function BinanceAPI(credentials) { this.method = async function () { ... } }`)
- **Functional React components** with hooks; no class components, no global state libraries
- All files use `.js`/`.jsx` extension (no TypeScript except `src/electrobun/index.ts` and `electrobun.config.ts`); shadcn/ui components use `.jsx`
- **Path alias**: `@/*` maps to `src/views/` (configured in `jsconfig.json` and `vite.config.js`)
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

