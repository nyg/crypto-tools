import { afterAll, beforeAll, expect, test } from 'bun:test'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type { Trade } from '../../types/kraken'

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crypto-tools-database-'))

const syncedAt = Date.UTC(2024, 2, 10)

const trade = (txid: string, pair: string, assets: Partial<Trade> = {}): Trade => ({
   txid, ordertxid: `O${txid}`, orderKey: `O${txid}`,
   pair, pairKey: pair.replace('/', ''), baseAsset: '', quoteAsset: '',
   time: Date.UTC(2014, 11, 2), type: 'buy', ordertype: 'limit',
   price: '100', cost: '100', fee: '1', vol: '1', margin: '0', misc: '', ...assets
})

beforeAll(() => {
   process.env.CRYPTO_TOOLS_DATA_DIR = dataDir
})

afterAll(async () => {
   const { closeDatabase } = await import('./database')
   closeDatabase()
   fs.rmSync(dataDir, { recursive: true, force: true })
})

test('resolveUnresolvedTradePairs gives the stored trades of a delisted pair their assets', async () => {

   const { getDatabase, resolveUnresolvedTradePairs } = await import('./database')
   const TradeRepository = (await import('./trade-repository')).default

   const repository = new TradeRepository('account')
   repository.upsertTrades([
      trade('A', 'BTC/LTC'),
      trade('B', 'BTC/LTC'),
      trade('C', 'BTC/NMC'),
      trade('D', 'MATIC/POL'),
      trade('E', 'FOOBAR'),
      trade('F', 'XBTUSD', { pairKey: 'BTC/USD', baseAsset: 'BTC', quoteAsset: 'USD' })
   ], syncedAt)

   resolveUnresolvedTradePairs(getDatabase())

   expect(repository.distinctOrderFilters().markets).toEqual([
      { pairKey: 'BTC/LTC', baseAsset: 'BTC', quoteAsset: 'LTC' },
      { pairKey: 'BTC/NMC', baseAsset: 'BTC', quoteAsset: 'NMC' },
      { pairKey: 'BTC/USD', baseAsset: 'BTC', quoteAsset: 'USD' },
      { pairKey: 'FOOBAR', baseAsset: '', quoteAsset: '' },
      { pairKey: 'MATIC/POL', baseAsset: 'MATIC', quoteAsset: 'POL' }
   ])

   const btcLtc = repository.queryAggregations({ filters: { base: 'BTC', quote: 'LTC' } })
   expect(btcLtc.rows.flatMap(row => row.orders.map(order => order.orderKey)).toSorted()).toEqual(['OA', 'OB'])
})
