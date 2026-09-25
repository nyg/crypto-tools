import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type LedgerRepositoryType from './ledger-repository'
import type { LedgerEntry } from '../../types/kraken'

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crypto-tools-ledger-'))

let LedgerRepository: typeof LedgerRepositoryType

const entry = (txid: string, time: number, amount: string, changes: Partial<LedgerEntry> = {}): LedgerEntry => ({
   txid, refid: `R${txid}`, time, type: 'earn', subtype: 'reward', aclass: 'currency',
   asset: 'DOT', baseAsset: 'DOT', wallet: 'earn / bonded', amount, fee: '0', balance: '', ...changes
})

beforeAll(async () => {
   process.env.CRYPTO_TOOLS_DATA_DIR = dataDir
   LedgerRepository = (await import('./ledger-repository')).default
})

afterAll(async () => {
   const { closeDatabase } = await import('./database')
   closeDatabase()
   fs.rmSync(dataDir, { recursive: true, force: true })
})

describe('rewardSummary', () => {

   const now = Date.UTC(2026, 8, 24, 12)

   const summarize = (entries: LedgerEntry[]) => {
      const repository = new LedgerRepository(`account-${entries.map(row => row.txid).join('-')}`)
      repository.upsertEntries(entries, now)
      return repository.rewardSummary(now)
   }

   test('charts the last twelve UTC months and the last fifty-two weeks starting on Monday', () => {

      const summary = summarize([entry('A', now, '1')])

      expect(summary.months).toHaveLength(12)
      expect(summary.months[0]).toBe(Date.UTC(2025, 9, 1))
      expect(summary.months.at(-1)).toBe(Date.UTC(2026, 8, 1))
      expect(summary.weeks).toHaveLength(52)
      expect(summary.weeks[0]).toBe(Date.UTC(2025, 8, 29))
      expect(summary.weeks.at(-1)).toBe(Date.UTC(2026, 8, 21))
   })

   test('puts a Sunday reward in the week that began the Monday before', () => {

      const summary = summarize([
         entry('MON', Date.UTC(2026, 8, 21), '2'),
         entry('SUN', Date.UTC(2026, 8, 20, 23, 59), '3')
      ])

      expect(summary.assets[0]?.byWeek).toEqual({
         [Date.UTC(2026, 8, 21)]: 2,
         [Date.UTC(2026, 8, 14)]: 3
      })
      expect(summary.assets[0]?.byMonth).toEqual({ [Date.UTC(2026, 8, 1)]: 5 })
   })

   test('leaves out rewards older than the window, allocations, and the fee', () => {

      const summary = summarize([
         entry('IN', Date.UTC(2025, 9, 1), '4', { fee: '0.5' }),
         entry('OUT', Date.UTC(2025, 8, 28), '8'),
         entry('ALLOC', Date.UTC(2026, 8, 22), '100', { subtype: 'allocation' })
      ])

      expect(summary.assets[0]?.byMonth).toEqual({ [Date.UTC(2025, 9, 1)]: 3.5 })
      expect(summary.assets[0]?.byWeek).toEqual({ [Date.UTC(2025, 8, 29)]: 3.5 })
      expect(summary.assets[0]?.total).toBe(11.5)
   })
})
