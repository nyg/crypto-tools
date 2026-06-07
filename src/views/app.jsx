import { BrowserRouter, Routes, Route } from 'react-router'
import { SWRConfig } from 'swr'
import './styles/global.css'
import Home from './pages/home'
import Settings from './pages/settings'
import BinanceStaking from './pages/binance/staking'
import KrakenBalances from './pages/kraken/balances'
import KrakenClosedOrders from './pages/kraken/closed-orders'
import KrakenOrderBatch from './pages/kraken/order-batch'
import KrakenXStocks from './pages/kraken/xstocks'

const isMockMode = import.meta.env.VITE_MOCK_DATA === 'true'
// In Electrobun production, the page loads from views:// so relative /api paths won't reach
// the Hono server. VITE_API_BASE is injected at build time by scripts/prebuild.ts.
const API_BASE = import.meta.env.VITE_API_BASE ?? ''

if (isMockMode) {
   import('./mocks').then(({ initMockCredentials }) => initMockCredentials())
}

async function fetcher(url, params) {

   if (isMockMode) {
      const { mockFetcher } = await import('./mocks')
      return mockFetcher(url, params)
   }

   let response
   if (params?.arg) {
      response = await fetch(API_BASE + url, {
         method: 'POST',
         body: JSON.stringify(params.arg),
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
         <BrowserRouter>
            <Routes>
               <Route path="/" element={<Home />} />
               <Route path="/settings" element={<Settings />} />
               <Route path="/binance/staking" element={<BinanceStaking />} />
               <Route path="/kraken/balances" element={<KrakenBalances />} />
               <Route path="/kraken/closed-orders" element={<KrakenClosedOrders />} />
               <Route path="/kraken/order-batch" element={<KrakenOrderBatch />} />
               <Route path="/kraken/xstocks" element={<KrakenXStocks />} />
            </Routes>
         </BrowserRouter>
      </SWRConfig>
   )
}
