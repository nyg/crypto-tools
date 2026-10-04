import { afterAll, beforeAll, expect, test } from 'bun:test'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type { LedgerEntry } from '../../types/kraken'

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crypto-tools-database-'))

const syncedAt = Date.UTC(2024, 2, 10)

const stored = (txid: string, asset: string, baseAsset: string): LedgerEntry => ({
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

test('keepTickerDigits moves the stored entries of a suffixed ticker that ends in a digit back under it', async () => {

   const { getDatabase, keepTickerDigits } = await import('./database')
   const LedgerRepository = (await import('./ledger-repository')).default

   const repository = new LedgerRepository('digits')
   repository.upsertEntries([
      stored('A', 'LUNA2.F', 'LUNA'),
      stored('B', 'LUNA2.S', 'LUNA'),
      stored('C', 'LUNA2', 'LUNA2'),
      stored('D', 'LUNA.S', 'LUNA'),
      stored('E', 'LUNA', 'LUNA'),
      stored('F', 'USDT0.TEMPO', 'USDT'),
      stored('G', 'USDT.M', 'USDT'),
      stored('H', 'ETH2.S', 'ETH'),
      stored('I', 'DOT28.S', 'DOT')
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
