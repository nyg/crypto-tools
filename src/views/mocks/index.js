import {
   tradingPairs, orderBatch, balances, assetRates,
   xstockListings, xstockClassify, xstockDescribe
} from './kraken'
import {
   ledgerSync, ledgerSyncStatus, ledgerSyncCancel, ledgerClear,
   ledgerEntries, ledgerFilters, ledgerFees, ledgerRewards, ledgerBalances
} from './kraken-ledger'
import { tradeOrders, tradeFills, tradeFilters } from './kraken-trades'
import { aggregateBalance } from './binance'


const mockRoutes = {
   '/api/kraken/trading-pairs': () => tradingPairs,
   '/api/kraken/order-batch': (params) => orderBatch(params?.arg),
   '/api/kraken/balances': () => balances(),
   '/api/kraken/asset-rates': (params) => assetRates(params?.arg),
   '/api/kraken/xstocks/listings': (params) => xstockListings(params?.arg),
   '/api/kraken/xstocks/classify': (params) => xstockClassify(params?.arg),
   '/api/kraken/xstocks/describe': (params) => xstockDescribe(params?.arg),
   '/api/kraken/ledger/sync': (params) => ledgerSync(params?.arg),
   '/api/kraken/ledger/sync/status': () => ledgerSyncStatus(),
   '/api/kraken/ledger/sync/cancel': () => ledgerSyncCancel(),
   '/api/kraken/ledger/entries': (params) => ledgerEntries(params?.arg),
   '/api/kraken/ledger/filters': () => ledgerFilters(),
   '/api/kraken/ledger/fees': (params) => ledgerFees(params?.arg),
   '/api/kraken/ledger/rewards': () => ledgerRewards(),
   '/api/kraken/ledger/balances': () => ledgerBalances(),
   '/api/kraken/ledger/clear': () => ledgerClear(),
   '/api/kraken/ledger/trades/orders': (params) => tradeOrders(params?.arg),
   '/api/kraken/ledger/trades/fills': (params) => tradeFills(params?.arg),
   '/api/kraken/ledger/trades/filters': () => tradeFilters(),
   '/api/binance/aggregate-balance': () => aggregateBalance,
}

export async function mockFetcher(url, params) {
   await new Promise(resolve => setTimeout(resolve, 300))

   const handler = mockRoutes[url]
   if (handler) return handler(params)

   console.warn(`[mock] No mock data for ${url}`)
   return {}
}

export function initMockCredentials() {
   if (typeof window === 'undefined') return

   const keys = {
      'binance.api.key': 'mock-binance-key',
      'binance.api.secret': 'mock-binance-secret',
      'kraken.api.key': 'mock-kraken-key',
      'kraken.api.secret': 'mock-kraken-secret',
      'anthropic.api.key': 'mock-anthropic-key',
   }

   for (const [key, value] of Object.entries(keys)) {
      if (!localStorage.getItem(key)) {
         localStorage.setItem(key, value)
      }
   }
}
