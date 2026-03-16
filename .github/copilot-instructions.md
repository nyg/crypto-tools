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

**Components** (`components/`) — exchange-specific components live in `components/binance/` and `components/kraken/`. Reusable UI primitives (input, checkbox, select, date-picker, etc.) live in `components/lib/`.

**Adapters** (`lib/adapters/`) — each external API (Binance, Kraken, Anthropic) has an adapter following a three-layer pattern:
- `adapter.js` — public interface with domain methods
- `resource.js` — raw HTTP endpoint calls
- `authenticator.js` — request signing (HMAC-SHA256 for Binance, HMAC-SHA512 for Kraken)

Two HTTP requester implementations (`lib/adapters/http-requester/`) abstract the transport layer: `server-http-requester.js` uses `got` (Node.js), `browser-http-requester.js` uses `fetch`.

**Services** (`lib/services/`) — `rate-finder.js` uses Dijkstra's algorithm to find trading pair paths and calculate fiat rates.

**Utils** (`utils/`) — `crypto.js` wraps Web Crypto API for hashing/HMAC, `format.js` provides locale-aware formatting via `Intl`, `event-bus.js` is a DOM-based pub/sub.

### Data Flow

1. Pages fetch data via SWR. Read-only data uses `useSWR` (auto-fetch); authenticated operations use `useSWRMutation` (manual trigger).
2. The global SWR fetcher in `pages/_app.js` routes GET vs POST based on the presence of `params.arg`.
3. API routes receive credentials in the request body, instantiate the appropriate adapter, call the exchange API server-side, and return results.
4. API keys are stored in `localStorage` per provider (e.g. `binance.api.key`, `kraken.api.secret`) with fallback to `NEXT_PUBLIC_*` env vars.

### AI Integration

`lib/adapters/anthropic/adapter.js` uses Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) with Zod-validated structured output to classify Kraken tokenized assets as stock/ETF/unknown. Called from the `/api/kraken/xstocks` route.

## Code Conventions

- **3-space indentation**, no semicolons, single quotes (enforced by ESLint)
- **Styling**: Tailwind CSS v4 + daisyUI v5 utility classes only — no custom CSS
- **Precision math**: use `big.js` for all numeric calculations involving asset amounts or rates
- **Constructor functions** over ES6 classes for adapters (e.g. `function BinanceAPI(credentials) { ... }`)
- **Functional React components** with hooks; no class components, no global state libraries
- All files use `.js` extension (no TypeScript)
