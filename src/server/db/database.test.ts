import { afterAll, beforeAll, expect, test } from 'bun:test'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type { Trade } from '../../types/kraken'

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crypto-tools-database-'))

const syncedAt = Date.UTC(2024, 2, 10)

const unresolved = (txid: string, pair: string): Trade => ({
   txid, ordertxid: `O${txid}`, orderKey: `O${txid}`,
   pair, pairKey: pair.replace('/', ''), baseAsset: '', quoteAsset: '',
   time: Date.UTC(2014, 11, 2), type: 'buy', ordertype: 'limit',
   price: '100', cost: '100', fee: '1', vol: '1', margin: '0', misc: ''
})

const stored = (txid: string, pair: string, pairKey: string, baseAsset: string, quoteAsset: string): Trade =>
   ({ ...unresolved(txid, pair), pairKey, baseAsset, quoteAsset })

const storedPairs = async (accountId: string, trades: Trade[]) => {

   const TradeRepository = (await import('./trade-repository')).default
   const repository = new TradeRepository(accountId)
   repository.upsertTrades(trades, syncedAt)

   return () => repository.queryTrades({ sort: { column: 'pair', direction: 'asc' } }).rows
      .map(row => [row.rawPair, row.pair, row.baseAsset, row.quoteAsset])
}

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

   const pairs = await storedPairs('unresolved', [
      unresolved('A', 'BTC/LTC'),
      unresolved('B', 'BTC/NMC'),
      unresolved('C', 'MATIC/POL'),
      unresolved('D', 'FOOBAR'),
      stored('E', 'XBTUSD', 'BTC/USD', 'BTC', 'USD')
   ])

   resolveUnresolvedTradePairs(getDatabase())

   expect(pairs()).toEqual([
      ['BTC/LTC', 'BTC/LTC', 'BTC', 'LTC'],
      ['BTC/NMC', 'BTC/NMC', 'BTC', 'NMC'],
      ['XBTUSD', 'BTC/USD', 'BTC', 'USD'],
      ['FOOBAR', 'FOOBAR', '', ''],
      ['MATIC/POL', 'MATIC/POL', 'POL', 'POL']
   ])
})

test('nameTradesAsTraded gives the stored trades of a renamed asset the pair they were made in', async () => {

   const { getDatabase, nameTradesAsTraded } = await import('./database')

   const pairs = await storedPairs('renamed', [
      stored('A', 'MATIC/EUR', 'POL/EUR', 'POL', 'EUR'),
      stored('B', 'POLEUR', 'POL/EUR', 'POL', 'EUR'),
      stored('C', 'MATIC/POL', 'MATIC/POL', 'MATIC', 'POL'),
      stored('D', 'POLPYUSD', 'POL/PYUSD', 'POL', 'PYUSD'),
      stored('E', 'XBTUSD', 'BTC/USD', 'BTC', 'USD')
   ])

   const renamed = [
      ['XBTUSD', 'BTC/USD', 'BTC', 'USD'],
      ['MATIC/EUR', 'MATIC/EUR', 'POL', 'EUR'],
      ['MATIC/POL', 'MATIC/POL', 'POL', 'POL'],
      ['POLEUR', 'POL/EUR', 'POL', 'EUR'],
      ['POLPYUSD', 'POL/PYUSD', 'POL', 'PYUSD']
   ]

   nameTradesAsTraded(getDatabase())
   expect(pairs()).toEqual(renamed)

   nameTradesAsTraded(getDatabase())
   expect(pairs()).toEqual(renamed)
})
