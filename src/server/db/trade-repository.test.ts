import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type TradeRepositoryType from './trade-repository'
import type { AggregationsResponse } from '../../types/api'
import type { Trade } from '../../types/kraken'

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crypto-tools-trades-'))

const DAY_MS = 86400000
const HOUR_MS = 3600000

const monday = Date.UTC(2024, 2, 4)
const tuesday = monday + DAY_MS
const syncedAt = Date.UTC(2024, 2, 10)

let TradeRepository: typeof TradeRepositoryType

const trade = (txid: string, pairKey: string, time: number, changes: Partial<Trade> = {}): Trade => {
   const [baseAsset = '', quoteAsset = ''] = pairKey.split('/')
   return {
      txid, ordertxid: `O${txid}`, orderKey: `O${txid}`,
      pair: `${baseAsset}${quoteAsset}`, pairKey, baseAsset, quoteAsset,
      time, type: 'buy', ordertype: 'limit', price: '100', cost: '100', fee: '1', vol: '1',
      margin: '0', misc: '', ...changes
   }
}

const mixedQuotes = [
   trade('A', 'BTC/USD', monday + HOUR_MS),
   trade('B', 'BTC/EUR', monday + 2 * HOUR_MS),
   trade('C', 'BTC/CHF', tuesday + HOUR_MS, { type: 'sell' }),
   trade('D', 'BTC/EUR', tuesday + 2 * HOUR_MS)
]

const repositoryOf = (accountId: string, trades: Trade[]) => {
   const repository = new TradeRepository(accountId)
   repository.upsertTrades(trades, syncedAt)
   return repository
}

const runsOf = (response: AggregationsResponse) => response.rows.map(row => ({
   direction: row.direction,
   orders: row.orders.map(order => order.orderKey)
}))

beforeAll(async () => {

   process.env.CRYPTO_TOOLS_DATA_DIR = dataDir
   TradeRepository = (await import('./trade-repository')).default

   const RateRepository = (await import('./rate-repository')).default

   new RateRepository().upsertRates([
      { asset: 'EUR', day: monday, rate: 1.1, source: 'ecb' },
      { asset: 'EUR', day: tuesday, rate: 1.2, source: 'ecb' },
      { asset: 'CHF', day: monday, rate: 1.25, source: 'ecb' },
      { asset: 'CHF', day: tuesday, rate: 1.6, source: 'ecb' }
   ])
})

afterAll(async () => {
   const { closeDatabase } = await import('./database')
   closeDatabase()
   fs.rmSync(dataDir, { recursive: true, force: true })
})

describe('distinctOrderFilters', () => {

   test('lists one market per base and quote asset, labelled with the pairs it was traded as', () => {

      const repository = repositoryOf('markets', [
         trade('A', 'BTC/USD', monday),
         trade('B', 'POL/EUR', tuesday),
         trade('C', 'MATIC/EUR', monday, { baseAsset: 'POL' }),
         trade('D', 'MATIC/GBP', monday, { baseAsset: 'POL' }),
         trade('E', 'MATIC/POL', monday, { baseAsset: 'POL' }),
         trade('F', 'FOOBAR', monday, { baseAsset: '', quoteAsset: '' })
      ])

      expect(repository.distinctOrderFilters().markets).toEqual([
         { pairKey: 'BTC/USD', baseAsset: 'BTC', quoteAsset: 'USD', label: 'BTC/USD' },
         { pairKey: 'FOOBAR', baseAsset: '', quoteAsset: '', label: 'FOOBAR' },
         { pairKey: 'POL/GBP', baseAsset: 'POL', quoteAsset: 'GBP', label: 'MATIC/GBP' },
         { pairKey: 'POL/POL', baseAsset: 'POL', quoteAsset: 'POL', label: 'MATIC/POL' },
         { pairKey: 'POL/EUR', baseAsset: 'POL', quoteAsset: 'EUR', label: 'POL/EUR (ex. MATIC/EUR)' }
      ])
   })
})

describe('queryAggregations', () => {

   test('adds up a renamed asset across the pairs it was traded as, each order under its own', () => {

      const repository = repositoryOf('renamed', [
         trade('A', 'MATIC/EUR', monday, { baseAsset: 'POL' }),
         trade('B', 'POL/EUR', tuesday)
      ])

      const { rows } = repository.queryAggregations({ filters: { base: 'POL', quote: 'EUR', order: 'asc' } })

      expect(rows.flatMap(row => row.orders.map(order => order.pair))).toEqual(['MATIC/EUR', 'POL/EUR'])
   })

   test('merges the same orders into the same runs whichever fiat quote is selected', () => {

      const repository = repositoryOf('same-runs', mixedQuotes)

      const inUsd = repository.queryAggregations({ filters: { base: 'BTC', quote: 'USD', includeAllQuotes: true, order: 'asc' } })
      const inChf = repository.queryAggregations({ filters: { base: 'BTC', quote: 'CHF', includeAllQuotes: true, order: 'asc' } })

      expect(runsOf(inUsd)).toEqual([
         { direction: 'buy', orders: ['OA', 'OB'] },
         { direction: 'sell', orders: ['OC'] },
         { direction: 'buy', orders: ['OD'] }
      ])
      expect(runsOf(inChf)).toEqual(runsOf(inUsd))
   })

   test('converts each order into the selected quote at the rate of its own day', () => {

      const repository = repositoryOf('own-day', mixedQuotes)

      const inUsd = repository.queryAggregations({ filters: { base: 'BTC', quote: 'USD', includeAllQuotes: true, order: 'asc' } })
      const inChf = repository.queryAggregations({ filters: { base: 'BTC', quote: 'CHF', includeAllQuotes: true, order: 'asc' } })

      expect(inUsd.rows.map(row => row.totals)).toEqual([
         { volume: '2', cost: '210', fee: '2.1', netCost: '212.1', price: '105', converted: true, unconverted: [] },
         { volume: '1', cost: '160', fee: '1.6', netCost: '158.4', price: '160', converted: true, unconverted: [] },
         { volume: '1', cost: '120', fee: '1.2', netCost: '121.2', price: '120', converted: true, unconverted: [] }
      ])
      expect(inChf.rows.map(row => row.totals)).toEqual([
         { volume: '2', cost: '168', fee: '1.68', netCost: '169.68', price: '84', converted: true, unconverted: [] },
         { volume: '1', cost: '100', fee: '1', netCost: '99', price: '100', converted: false, unconverted: [] },
         { volume: '1', cost: '75', fee: '0.75', netCost: '75.75', price: '75', converted: true, unconverted: [] }
      ])
   })

   test('totals each side of the summary from the same converted orders', () => {

      const repository = repositoryOf('summary', mixedQuotes)

      const { summary } = repository.queryAggregations({ filters: { base: 'BTC', quote: 'USD', includeAllQuotes: true } })

      expect(summary.buy.totals).toEqual({
         volume: '3', cost: '330', fee: '3.3', netCost: '333.3', price: '110', converted: true, unconverted: []
      })
      expect(summary.sell.totals).toEqual({
         volume: '1', cost: '160', fee: '1.6', netCost: '158.4', price: '160', converted: true, unconverted: []
      })
   })

   test('keeps a single quote exact when the others are not merged in', () => {

      const repository = repositoryOf('single-quote', mixedQuotes)

      const response = repository.queryAggregations({ filters: { base: 'BTC', quote: 'EUR', order: 'asc' } })

      expect(runsOf(response)).toEqual([{ direction: 'buy', orders: ['OB', 'OD'] }])
      expect(response.rows[0]?.totals).toEqual({
         volume: '2', cost: '200', fee: '2', netCost: '202', price: '100', converted: false, unconverted: []
      })
   })

   test('leaves crypto-quoted and unresolved orders out of the merge', () => {

      const repository = repositoryOf('fiat-only', [
         trade('A', 'ETH/USD', monday + HOUR_MS),
         trade('B', 'ETH/BTC', monday + 2 * HOUR_MS),
         trade('C', 'ETH/', monday + 3 * HOUR_MS),
         trade('D', 'ETH/USDT', monday + 4 * HOUR_MS)
      ])

      const response = repository.queryAggregations({ filters: { base: 'ETH', quote: 'USD', includeAllQuotes: true } })

      expect(runsOf(response)).toEqual([{ direction: 'buy', orders: ['OA', 'OD'] }])
   })

   test('ignores the merge for a pair quoted in another coin', () => {

      const repository = repositoryOf('crypto-quote', [
         trade('A', 'ETH/USD', monday + HOUR_MS),
         trade('B', 'ETH/BTC', monday + 2 * HOUR_MS)
      ])

      const response = repository.queryAggregations({ filters: { base: 'ETH', quote: 'BTC', includeAllQuotes: true } })

      expect(runsOf(response)).toEqual([{ direction: 'buy', orders: ['OB'] }])
      expect(response.rows[0]?.totals.converted).toBe(false)
      expect(response.rows[0]?.totals.cost).toBe('100')
   })

   test('leaves out an order whose day has no rate and names its volume', () => {

      const repository = repositoryOf('no-rate', [
         trade('A', 'BTC/USD', monday + HOUR_MS),
         trade('B', 'BTC/GBP', monday + 2 * HOUR_MS, { vol: '0.5' })
      ])

      const response = repository.queryAggregations({ filters: { base: 'BTC', quote: 'USD', includeAllQuotes: true } })

      expect(response.rows[0]?.volume).toBe('1.5')
      expect(response.rows[0]?.totals).toEqual({
         volume: '1', cost: '100', fee: '1', netCost: '101', price: '100', converted: false,
         unconverted: [{ quoteAsset: 'GBP', volume: '0.5' }]
      })
   })

   test('uses the last stored rate for an order on a day that has none yet', () => {

      const repository = repositoryOf('carried', [
         trade('A', 'BTC/EUR', tuesday + 3 * DAY_MS)
      ])

      const response = repository.queryAggregations({ filters: { base: 'BTC', quote: 'USD', includeAllQuotes: true } })

      expect(response.rows[0]?.totals.cost).toBe('120')
   })
})

describe('quoteAssetRanges', () => {

   test('spans the merged trades of every base traded in more than one fiat quote', () => {

      const repository = repositoryOf('ranges', [
         trade('A', 'SOL/EUR', monday - 30 * DAY_MS),
         trade('B', 'BTC/USD', monday + HOUR_MS),
         trade('C', 'BTC/EUR', tuesday + HOUR_MS),
         trade('D', 'ETH/BTC', tuesday + 10 * DAY_MS),
         trade('E', 'ETH/USD', tuesday + 11 * DAY_MS)
      ])

      const ranges = repository.quoteAssetRanges().toSorted((a, b) => a.asset.localeCompare(b.asset))

      expect(ranges).toEqual([
         { asset: 'EUR', first: monday + HOUR_MS, last: tuesday + HOUR_MS },
         { asset: 'USD', first: monday + HOUR_MS, last: tuesday + HOUR_MS }
      ])
   })
})
