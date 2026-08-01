import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router'
import { SWRConfig } from 'swr'
import './styles/global.css'
import Home from './pages/home'
import Settings from './pages/settings'
import BinanceStaking from './pages/binance/staking'
import KrakenBalances from './pages/kraken/balances'
import KrakenClosedOrders from './pages/kraken/closed-orders'
import KrakenFees from './pages/kraken/fees'
import KrakenLedger from './pages/kraken/ledger'
import KrakenOrderBatch from './pages/kraken/order-batch'
import KrakenXStocks from './pages/kraken/xstocks'

const isMockMode = import.meta.env.VITE_MOCK_DATA === 'true'
// Under views:// (Electrobun) the page's origin is opaque and the History API is unusable,
// so react-router Links trigger real navigations that macOS tries to open externally.
// Hash-based routing keeps navigation inside the page regardless of scheme.
const Router = window.location.protocol === 'views:' ? HashRouter : BrowserRouter
// In Electrobun production, the page loads from views:// so relative /api paths won't reach
// the Hono server. VITE_API_BASE is injected at build time by scripts/prebuild.ts.
const API_BASE = import.meta.env.VITE_API_BASE ?? ''

if (isMockMode) {
   import('./mocks').then(({ initMockCredentials }) => initMockCredentials())
}

async function fetcher(key, params) {

   // SWR hands the whole key to the fetcher: a plain string, or the array itself for
   // array keys. useSWRMutation passes the body separately as { arg }. An array key
   // is how a useSWR call (which has no arg) can still POST a request body.
   const url = Array.isArray(key) ? key[0] : key
   const body = Array.isArray(key) ? key[1] : params?.arg

   if (isMockMode) {
      const { mockFetcher } = await import('./mocks')
      return mockFetcher(url, body ? { arg: body } : undefined)
   }

   let response
   if (body) {
      response = await fetch(API_BASE + url, {
         method: 'POST',
         body: JSON.stringify(body),
         headers: { 'Content-Type': 'application/json' }
      })
   }
   else {
      response = await fetch(API_BASE + url)
   }

   const result = await response.json()
   if (!response.ok) {
      const error = result?.error || 'An unexpected error happened.'
      return Promise.reject(error)
   }

   return result
}

export default function App() {
   return (
      <SWRConfig value={{ fetcher }}>
         <Router>
            <Routes>
               <Route path="/" element={<Home />} />
               <Route path="/settings" element={<Settings />} />
               <Route path="/binance/staking" element={<BinanceStaking />} />
               <Route path="/kraken/balances" element={<KrakenBalances />} />
               <Route path="/kraken/closed-orders" element={<KrakenClosedOrders />} />
               <Route path="/kraken/fees" element={<KrakenFees />} />
               <Route path="/kraken/ledger" element={<KrakenLedger />} />
               <Route path="/kraken/order-batch" element={<KrakenOrderBatch />} />
               <Route path="/kraken/xstocks" element={<KrakenXStocks />} />
               <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
         </Router>
      </SWRConfig>
   )
}
