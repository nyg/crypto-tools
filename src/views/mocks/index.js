import { tradingPairs, orderBatch, balances, closedOrders, xstocks } from './kraken'
import { aggregateBalance } from './binance'


const mockRoutes = {
   '/api/kraken/trading-pairs': () => tradingPairs,
   '/api/kraken/order-batch': (params) => orderBatch(params?.arg),
   '/api/kraken/balances': () => balances,
   '/api/kraken/closed-orders': () => closedOrders,
   '/api/kraken/xstocks': () => xstocks,
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
