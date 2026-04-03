# Copilot Instructions

## Build & Run

- **Package manager**: pnpm
- **Dev server**: `pnpm dev` (runs Next.js with `--turbo` and `--inspect`)
- **Build**: `pnpm build`
- **Lint**: `pnpm lint` (ESLint with next/core-web-vitals)

No test framework is configured.

## Architecture

This is a Next.js 16 app (Pages Router) providing cryptocurrency tools for Binance and Kraken exchanges, plus AI-powered asset classification via Anthropic.

### Layers

**Pages** (`pages/`) — file-based routing. Each exchange has its own subdirectory. `pages/api/` contains server-side API routes that proxy to external exchange APIs.

**Components** (`components/`) — exchange-specific components live in `components/binance/` and `components/kraken/`. Custom wrapper components (NumericInput, Checkbox, Select, DatePicker, etc.) live in `components/lib/` and wrap the shadcn/ui primitives in `components/ui/`. shadcn/ui is configured with `rsc: false`, `tsx: false`, and `radix-nova` style.

**Adapters** (`lib/adapters/`) — each external API has an adapter directory (`binance-api/`, `binance-gateway-api/`, `kraken-api/`, `anthropic/`) following a three-layer pattern documented in `lib/adapters/README.md`:
- `adapter.js` — public interface with domain methods (constructor function, default export)
- `resource.js` — raw HTTP endpoint calls (named exports)
- `authenticator.js` — request signing as a higher-order function: `authenticator(credentials)` returns `async (request) => signedRequest`

Two HTTP requester singletons (`lib/adapters/http-requester/`) abstract the transport layer: `server-http-requester.js` uses `got` (Node.js), `browser-http-requester.js` uses `fetch`. Both export `httpRequester` as a pre-instantiated singleton.

**Services** (`lib/services/`) — `rate-finder.js` uses Dijkstra's algorithm (`modern-dijkstra`) to find trading pair paths and calculate fiat rates against USDT.

**Utils** (`utils/`) — `crypto.js` wraps Web Crypto API using higher-order factory functions (`hash(algo)`, `hmac(algo)`) that export `sha256`, `hmacSha256`, `hmacSha512`. `format.js` provides en-GB locale formatting via `Intl`. `event-bus.js` is a DOM-based pub/sub (SSR-safe, returns cleanup functions for `useEffect`).

### Data Flow

1. Pages fetch data via SWR. Public/read-only data uses `useSWR` (auto-fetch); authenticated operations use `useSWRMutation` (manual trigger).
2. The global SWR fetcher in `pages/_app.js` routes GET vs POST based on the presence of `params.arg`.
3. API routes destructure credentials from `req.body.credentials`, validate they exist (401 if missing), instantiate the appropriate adapter with `new AdapterName(credentials)`, and return JSON.
4. API keys are stored in `localStorage` per provider (e.g. `binance.api.key`, `kraken.api.secret`) with fallback to `NEXT_PUBLIC_*` env vars. Always guard localStorage access with `typeof window !== 'undefined'`.

### AI Integration

`lib/adapters/anthropic/adapter.js` uses Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) with Zod-validated structured output to classify Kraken tokenized assets as stock/ETF/unknown. Called from the `/api/kraken/xstocks` route.

## Code Conventions

- **3-space indentation**, no semicolons, single quotes (enforced by ESLint; `react-hooks/exhaustive-deps` is disabled)
- **Styling**: Tailwind CSS v4 + shadcn/ui components — no custom CSS, no daisyUI
- **Precision math**: use `big.js` for all numeric calculations involving asset amounts or rates
- **Constructor functions** over ES6 classes (e.g. `export default function BinanceAPI(credentials) { this.method = async function () { ... } }`)
- **Functional React components** with hooks; no class components, no global state libraries
- All files use `.js` extension (no TypeScript); shadcn/ui components use `.jsx`
- **Path alias**: `@/*` maps to project root (configured in `jsconfig.json`)
- **Class merging**: use `cn()` from `lib/utils.js` (`clsx` + `tailwind-merge`) for conditional Tailwind classes

## Branching workflow

- Never commit directly to `master`. Always open a pull request against `master`.
- If the current branch is not `master`, do work on that branch.
- If the current branch is `master`, create a new feature branch before making any changes.
