import type { Page } from 'playwright-core'

export interface Shot {
   name: string
   path: string
   width?: number
   storage?: Record<string, unknown>
   prepare?: (page: Page) => Promise<void>
}

const today = new Date().toISOString().slice(0, 10).replaceAll('-', '')

const click = (name: string) => (page: Page) => page.getByRole('button', { name, exact: true }).first().click()

export const shots: Shot[] = [
   { name: 'home', path: '/' },
   { name: 'kraken-ledger', path: '/kraken/ledger' },
   { name: 'kraken-balances', path: '/kraken/balances' },
   { name: 'kraken-rewards', path: '/kraken/rewards' },
   { name: 'kraken-fees', path: '/kraken/fees' },
   {
      name: 'kraken-aggregated-trades',
      path: '/kraken/aggregated-trades',
      storage: {
         'kraken.aggregatedTrades.filters': { pairKey: 'BTC/USD', includeAllQuotes: true, from: null, to: null, order: 'desc' }
      },
      prepare: page => page.locator('table button[aria-expanded="false"]').first().click()
   },
   { name: 'kraken-open-orders', path: '/kraken/open-orders' },
   {
      name: 'kraken-order-batch',
      path: '/kraken/order-batch',
      storage: {
         'kraken.orderBatch.formValues': {
            pair: 'XBTUSD', direction: 'buy', priceFrom: '60000', priceTo: '52000', volume: '0.5',
            orderCount: '12', priceFn: 'linear', volumeFn: 'linear-quote', userref: today
         }
      },
      prepare: click('Show preview')
   },
   { name: 'kraken-xstocks', path: '/kraken/xstocks' },
   { name: 'binance-staking', path: '/binance/staking', prepare: click('Fetch data') },
   { name: 'bybit-portfolios', path: '/bybit/portfolios' }
]
