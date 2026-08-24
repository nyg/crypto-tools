import {
   tradingPairs, orderBatch, balances, assetRates, openOrders, cancelOrders,
   xstockListings, xstockClassify, xstockDescribe, xstockJob, xstockJobCancel
} from './kraken'
import {
   ledgerSync, ledgerSyncStatus, ledgerSyncCancel, ledgerClear,
   ledgerEntries, ledgerFilters, ledgerFees, ledgerRewards, ledgerBalances
} from './kraken-ledger'
import { tradeAggregations, tradeRows, tradeFilters } from './kraken-trades'
import { aggregateBalance } from './binance'
import type { LatestRelease } from '../../types/api'
import type { MaskedSettings } from '../../types/settings'

// A mocked route is handed the request body the fetcher would have posted, under the
// same { arg } SWR wraps a mutation argument in.
type MockParams = { arg?: unknown }
type MockRoute = (params?: MockParams) => unknown

// The fetcher posts the request body under { arg }, and each route below knows the
// shape it asked for — which is what the inferred T here picks up.
const body = <T>(params?: MockParams) => params?.arg as T | undefined


const mockRoutes: Record<string, MockRoute> = {
   '/api/kraken/trading-pairs': () => tradingPairs,
   '/api/kraken/order-batch': (params) => orderBatch(body(params)),
   '/api/kraken/balances': () => balances(),
   '/api/kraken/open-orders': () => openOrders(),
   '/api/kraken/cancel-orders': (params) => cancelOrders(body(params)),
   '/api/kraken/asset-rates': (params) => assetRates(body(params)),
   '/api/kraken/xstocks/listings': (params) => xstockListings(body(params)),
   '/api/kraken/xstocks/classify': (params) => xstockClassify(body(params)),
   '/api/kraken/xstocks/describe': (params) => xstockDescribe(body(params)),
   '/api/kraken/xstocks/job': () => xstockJob(),
   '/api/kraken/xstocks/job/cancel': () => xstockJobCancel(),
   '/api/kraken/ledger/sync': (params) => ledgerSync(body(params)),
   '/api/kraken/ledger/sync/status': () => ledgerSyncStatus(),
   '/api/kraken/ledger/sync/cancel': () => ledgerSyncCancel(),
   '/api/kraken/ledger/entries': (params) => ledgerEntries(body(params)),
   '/api/kraken/ledger/filters': () => ledgerFilters(),
   '/api/kraken/ledger/fees': (params) => ledgerFees(body(params)),
   '/api/kraken/ledger/rewards': () => ledgerRewards(),
   '/api/kraken/ledger/balances': () => ledgerBalances(),
   '/api/kraken/ledger/clear': () => ledgerClear(),
   '/api/kraken/ledger/trades/aggregations': (params) => tradeAggregations(body(params)),
   '/api/kraken/ledger/trades': (params) => tradeRows(body(params)),
   '/api/kraken/ledger/trades/filters': () => tradeFilters(),
   '/api/binance/aggregate-balance': () => aggregateBalance,
   '/api/settings': () => mockSettings(false),
   '/api/settings?reveal=true': () => mockSettings(true),
   '/api/app/latest-release': () => mockLatestRelease,
}

const mockLatestRelease: LatestRelease = {
   version: '99.0.0',
   url: 'https://github.com/nyg/crypto-tools/releases/latest'
}

const mockSettings = (reveal: boolean): MaskedSettings => ({
   version: 1,
   binance: {
      apiKey: reveal ? 'mock-binance-key' : '*****', apiSecret: '*****', source: 'file',
      hasSecret: true, configured: true, keyConfigured: true
   },
   kraken: {
      apiKey: reveal ? 'mock-kraken-key' : '*****', apiSecret: '*****', source: 'file',
      hasSecret: true, configured: true, keyConfigured: true,
      accountId: 'mock-account-id'
   },
   anthropic: {
      apiKey: reveal ? 'mock-anthropic-key' : '*****', apiSecret: '', source: 'file',
      hasSecret: false, configured: true, keyConfigured: true
   }
})

export async function mockFetcher(url: string, params?: MockParams): Promise<unknown> {
   await new Promise(resolve => setTimeout(resolve, 300))

   const handler = mockRoutes[url]
   if (handler) return handler(params)

   console.warn(`[mock] No mock data for ${url}`)
   return {}
}
