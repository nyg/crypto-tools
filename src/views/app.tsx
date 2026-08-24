import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router'
import { SWRConfig } from 'swr'
import './styles/global.css'
import { fetcher } from './lib/fetcher'
import Home from './pages/home'
import Settings from './pages/settings'
import BinanceStaking from './pages/binance/staking'
import KrakenBalances from './pages/kraken/balances'
import KrakenAggregatedTrades from './pages/kraken/aggregated-trades'
import KrakenFees from './pages/kraken/fees'
import KrakenLedger from './pages/kraken/ledger'
import KrakenOpenOrders from './pages/kraken/open-orders'
import KrakenOrderBatch from './pages/kraken/order-batch'
import KrakenRewards from './pages/kraken/rewards'
import KrakenXStocks from './pages/kraken/xstocks'
import TradeCalculator from './pages/tools/trade-calculator'

// Under views:// (Electrobun) the page's origin is opaque and the History API is unusable,
// so react-router Links trigger real navigations that macOS tries to open externally.
// Hash-based routing keeps navigation inside the page regardless of scheme.
const Router = window.location.protocol === 'views:' ? HashRouter : BrowserRouter

export default function App() {
   return (
      <SWRConfig value={{ fetcher }}>
         <Router>
            <Routes>
               <Route path="/" element={<Home />} />
               <Route path="/settings" element={<Settings />} />
               <Route path="/binance/staking" element={<BinanceStaking />} />
               <Route path="/kraken/balances" element={<KrakenBalances />} />
               <Route path="/kraken/aggregated-trades" element={<KrakenAggregatedTrades />} />
               <Route path="/kraken/fees" element={<KrakenFees />} />
               <Route path="/kraken/ledger" element={<KrakenLedger />} />
               <Route path="/kraken/open-orders" element={<KrakenOpenOrders />} />
               <Route path="/kraken/order-batch" element={<KrakenOrderBatch />} />
               <Route path="/kraken/rewards" element={<KrakenRewards />} />
               <Route path="/kraken/xstocks" element={<KrakenXStocks />} />
               <Route path="/tools/trade-calculator" element={<TradeCalculator />} />
               <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
         </Router>
      </SWRConfig>
   )
}
