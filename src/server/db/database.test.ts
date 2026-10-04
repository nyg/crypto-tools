import { afterAll, beforeAll, expect, test } from 'bun:test'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type { LedgerEntry, Trade } from '../../types/kraken'

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

const storedEntry = (txid: string, asset: string, baseAsset: string): LedgerEntry => ({
   txid, refid: `R${txid}`, time: Date.UTC(2023, 5, 1), type: 'earn', subtype: 'reward', aclass: 'currency',
   asset, baseAsset, wallet: 'earn / flexible', amount: '1', fee: '0', balance: ''
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

test('keepTickerDigits moves the stored entries of a suffixed ticker that ends in a digit back under it', async () => {

   const { getDatabase, keepTickerDigits } = await import('./database')
   const LedgerRepository = (await import('./ledger-repository')).default

   const repository = new LedgerRepository('digits')
   repository.upsertEntries([
      storedEntry('A', 'LUNA2.F', 'LUNA'),
      storedEntry('B', 'LUNA2.S', 'LUNA'),
      storedEntry('C', 'LUNA2', 'LUNA2'),
      storedEntry('D', 'LUNA.S', 'LUNA'),
      storedEntry('E', 'LUNA', 'LUNA'),
      storedEntry('F', 'USDT0.TEMPO', 'USDT'),
      storedEntry('G', 'USDT.M', 'USDT'),
      storedEntry('H', 'ETH2.S', 'ETH'),
      storedEntry('I', 'DOT28.S', 'DOT')
   ], syncedAt)

   const baseAssets = () => Object.fromEntries(repository.queryEntries({}).rows
      .map(row => [row.asset, row.baseAsset]))

   const kept = {
      'LUNA2.F': 'LUNA2',
      'LUNA2.S': 'LUNA2',
      'LUNA2': 'LUNA2',
      'LUNA.S': 'LUNA',
      'LUNA': 'LUNA',
      'USDT0.TEMPO': 'USDT0',
      'USDT.M': 'USDT',
      'ETH2.S': 'ETH',
      'DOT28.S': 'DOT'
   }

   keepTickerDigits(getDatabase())
   expect(baseAssets()).toEqual(kept)

   keepTickerDigits(getDatabase())
   expect(baseAssets()).toEqual(kept)
})
