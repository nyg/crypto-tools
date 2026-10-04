import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type LedgerRepositoryType from './ledger-repository'
import type RateRepositoryType from './rate-repository'
import type { LedgerEntry } from '../../types/kraken'

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crypto-tools-ledger-'))

let LedgerRepository: typeof LedgerRepositoryType
let RateRepository: typeof RateRepositoryType

const unpriced = (amount: number) => ({ amount, value: null, unvalued: amount })

const entry = (txid: string, time: number, amount: string, changes: Partial<LedgerEntry> = {}): LedgerEntry => ({
   txid, refid: `R${txid}`, time, type: 'earn', subtype: 'reward', aclass: 'currency',
   asset: 'DOT', baseAsset: 'DOT', wallet: 'earn / bonded', amount, fee: '0', balance: '', ...changes
})

beforeAll(async () => {
   process.env.CRYPTO_TOOLS_DATA_DIR = dataDir
   LedgerRepository = (await import('./ledger-repository')).default
   RateRepository = (await import('./rate-repository')).default
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
         [Date.UTC(2026, 8, 21)]: unpriced(2),
         [Date.UTC(2026, 8, 14)]: unpriced(3)
      })
      expect(summary.assets[0]?.byMonth).toEqual({ [Date.UTC(2026, 8, 1)]: unpriced(5) })
   })

   test('leaves out rewards older than the window, allocations, and the fee', () => {

      const summary = summarize([
         entry('IN', Date.UTC(2025, 9, 1), '4', { fee: '0.5' }),
         entry('OUT', Date.UTC(2025, 8, 28), '8'),
         entry('ALLOC', Date.UTC(2026, 8, 22), '100', { subtype: 'allocation' })
      ])

      expect(summary.assets[0]?.byMonth).toEqual({ [Date.UTC(2025, 9, 1)]: unpriced(3.5) })
      expect(summary.assets[0]?.byWeek).toEqual({ [Date.UTC(2025, 8, 29)]: unpriced(3.5) })
      expect(summary.assets[0]?.total).toEqual(unpriced(11.5))
   })
})

describe('reward strategies', () => {

   const DAY = 86400000
   const now = Date.UTC(2026, 8, 24, 12)

   const strategiesOf = (entries: LedgerEntry[]) => {
      const repository = new LedgerRepository(`strategies-${entries.map(row => row.txid).join('-')}`)
      repository.upsertEntries(entries, now)
      return repository.rewardSummary(now).assets[0]?.strategies
   }

   test('names a strategy after the wallet its rewards were paid into', () => {

      const strategies = strategiesOf([
         entry('STAKED', Date.UTC(2023, 4, 1), '1', { type: 'staking', subtype: '', wallet: 'spot / main' }),
         entry('LIQUID', Date.UTC(2025, 4, 1), '2', { wallet: 'earn / liquid' }),
         entry('SPOT', Date.UTC(2026, 4, 1), '3', { wallet: 'spot / main' }),
         entry('LOCKED', Date.UTC(2026, 5, 1), '4', { wallet: 'earn / locked' })
      ])

      expect(strategies?.map(({ lockType, total, first, last }) => ({ lockType, total, first, last }))).toEqual([
         { lockType: 'staking', total: unpriced(1), first: Date.UTC(2023, 4, 1), last: Date.UTC(2023, 4, 1) },
         { lockType: 'flex', total: unpriced(5), first: Date.UTC(2025, 4, 1), last: Date.UTC(2026, 4, 1) },
         { lockType: 'timed', total: unpriced(4), first: Date.UTC(2026, 5, 1), last: Date.UTC(2026, 5, 1) }
      ])
   })

   test('splits each year between the strategies that paid in it', () => {

      const strategies = strategiesOf([
         entry('BONDED', Date.UTC(2026, 1, 1), '2'),
         entry('FLEXIBLE', Date.UTC(2026, 2, 1), '3', { wallet: 'earn / flexible' })
      ])

      expect(strategies?.map(({ lockType, byYear }) => ({ lockType, byYear }))).toEqual(expect.arrayContaining([
         { lockType: 'bonded', byYear: { 2026: unpriced(2) } },
         { lockType: 'instant', byYear: { 2026: unpriced(3) } }
      ]))
   })

   test('keeps a strategy active for as long as its Earn wallet holds something', () => {

      const allocated = [
         entry('IN', Date.UTC(2026, 0, 1), '100', { subtype: 'allocation' }),
         entry('PAID', Date.UTC(2026, 1, 1), '1')
      ]
      const emptied = [...allocated, entry('OUT', Date.UTC(2026, 2, 1), '-101', { subtype: 'deallocation' })]

      expect(strategiesOf(allocated)?.[0]?.active).toBe(true)
      expect(strategiesOf(emptied)?.[0]?.active).toBe(false)
   })

   test('ends Auto Earn once it has not paid for two weeks before the last entry', () => {

      const paid = entry('PAID', Date.UTC(2026, 8, 1), '1', { wallet: 'spot / main' })
      const deposit = (txid: string, time: number) =>
         entry(txid, time, '5', { type: 'deposit', subtype: '', wallet: 'spot / main' })

      expect(strategiesOf([paid, deposit('SOON', paid.time + 14 * DAY)])?.[0]?.active).toBe(true)
      expect(strategiesOf([paid, deposit('LATE', paid.time + 14 * DAY + 1)])?.[0]?.active).toBe(false)
   })

   test('never counts what was staked before Earn as active', () => {

      const strategies = strategiesOf([
         entry('STAKED', now, '1', { type: 'staking', subtype: '', wallet: 'spot / main' })
      ])

      expect(strategies?.[0]?.active).toBe(false)
   })
})

describe('USD valuation', () => {

   const now = Date.UTC(2026, 8, 24, 12)

   const repositoryWith = (name: string, entries: LedgerEntry[]) => {
      const repository = new LedgerRepository(`valuation-${name}`)
      repository.upsertEntries(entries, now)
      return repository
   }

   beforeAll(() => {
      new RateRepository().upsertRates([
         { asset: 'KSM', day: Date.UTC(2026, 7, 1), rate: 20, source: 'kraken-daily' },
         { asset: 'KSM', day: Date.UTC(2026, 7, 2), rate: 30, source: 'kraken-weekly' },
         { asset: 'EUR', day: Date.UTC(2026, 7, 1), rate: 1.1, source: 'ecb' }
      ])
   })

   test('values each reward at the rate of its own UTC day and counts a day without one apart', () => {

      const summary = repositoryWith('reward', [
         entry('K1', Date.UTC(2026, 7, 1, 10), '1', { asset: 'KSM.S', baseAsset: 'KSM' }),
         entry('K2', Date.UTC(2026, 7, 2, 23, 59), '2.5', { asset: 'KSM.S', baseAsset: 'KSM', fee: '0.5' }),
         entry('K3', Date.UTC(2026, 7, 3), '4', { asset: 'KSM.S', baseAsset: 'KSM' })
      ]).rewardSummary(now)

      const [ksm] = summary.assets
      expect(ksm?.total).toEqual({ amount: 7, value: 80, unvalued: 4 })
      expect(ksm?.byYear[2026]).toEqual({ amount: 7, value: 80, unvalued: 4 })
      expect(ksm?.byMonth[Date.UTC(2026, 7, 1)]).toEqual({ amount: 7, value: 80, unvalued: 4 })
   })

   test('values USD at one and leaves an asset with no rate at all without a value', () => {

      const summary = repositoryWith('usd', [
         entry('U1', Date.UTC(2026, 7, 5), '5', { asset: 'ZUSD', baseAsset: 'USD' }),
         entry('N1', Date.UTC(2026, 7, 5), '3', { asset: 'NORATE', baseAsset: 'NORATE' })
      ]).rewardSummary(now)

      expect(summary.assets.find(asset => asset.asset === 'USD')?.total).toEqual({ amount: 5, value: 5, unvalued: 0 })
      expect(summary.assets.find(asset => asset.asset === 'NORATE')?.total).toEqual(unpriced(3))
   })

   test('values the reward periods the same way', () => {

      const week = repositoryWith('period', [
         entry('P1', Date.UTC(2026, 8, 15), '2', { asset: 'ZUSD', baseAsset: 'USD' })
      ]).rewardSummary(now).periods.week

      expect(week?.assets).toEqual([{ asset: 'USD', total: 2, entries: 1, value: 2, unvalued: 0 }])
   })

   test('values each fee at the rate of the day it was charged', () => {

      const fees = repositoryWith('fees', [
         entry('F1', Date.UTC(2026, 7, 1, 8), '-10', { type: 'trade', subtype: '', asset: 'KSM', baseAsset: 'KSM', fee: '0.1' }),
         entry('F2', Date.UTC(2026, 7, 2, 8), '-10', { type: 'trade', subtype: '', asset: 'KSM', baseAsset: 'KSM', fee: '0.2' }),
         entry('F3', Date.UTC(2026, 7, 1, 8), '-10', { type: 'withdrawal', subtype: '', asset: 'ZEUR', baseAsset: 'EUR', fee: '2' }),
         entry('F4', Date.UTC(2026, 7, 9, 8), '-10', { type: 'trade', subtype: '', asset: 'ZEUR', baseAsset: 'EUR', fee: '3' })
      ]).feeSummary()

      const ksm = fees.assets.find(asset => asset.asset === 'KSM')
      const eur = fees.assets.find(asset => asset.asset === 'EUR')

      expect(ksm?.value).toBeCloseTo(8)
      expect(ksm?.unvalued).toBe(0)
      expect(eur?.value).toBeCloseTo(2.2)
      expect(eur?.unvalued).toBe(3)
      expect(fees.byType.find(row => row.asset === 'EUR' && row.type === 'trade')).toMatchObject({ value: null, unvalued: 3 })
      expect(fees.byMonth.find(row => row.asset === 'KSM')?.value).toBeCloseTo(8)
   })

   test('asks for rates over the rewards and fees only', () => {

      const ranges = repositoryWith('ranges', [
         entry('R1', Date.UTC(2026, 0, 1), '100', { type: 'deposit', subtype: '', asset: 'KSM', baseAsset: 'KSM' }),
         entry('R2', Date.UTC(2026, 2, 1), '1', { asset: 'KSM.S', baseAsset: 'KSM' }),
         entry('R3', Date.UTC(2026, 4, 1), '-1', { type: 'trade', subtype: '', asset: 'KSM', baseAsset: 'KSM', fee: '0.01' }),
         entry('R4', Date.UTC(2026, 5, 1), '5', { type: 'earn', subtype: 'allocation', asset: 'KSM.S', baseAsset: 'KSM' })
      ]).valuedAssetRanges()

      expect(ranges).toEqual([{ asset: 'KSM', first: Date.UTC(2026, 2, 1), last: Date.UTC(2026, 4, 1) }])
   })
})

describe('fundingEntries', () => {

   test('lists deposits and withdrawals under their display asset, oldest first', () => {

      const repository = new LedgerRepository('funding-entries')
      repository.upsertEntries([
         entry('W1', Date.UTC(2026, 7, 2), '-0.5', { type: 'withdrawal', subtype: '', asset: 'XXBT', baseAsset: 'BTC', fee: '0.0001' }),
         entry('D1', Date.UTC(2026, 7, 1), '1000.0000', { type: 'deposit', subtype: '', asset: 'ZEUR', baseAsset: 'EUR', refid: 'REF' }),
         entry('T1', Date.UTC(2026, 7, 3), '-10', { type: 'trade', subtype: '', asset: 'ZEUR', baseAsset: 'EUR' })
      ], Date.UTC(2026, 7, 4))

      expect(repository.fundingEntries()).toEqual([
         { entryKey: 'D1', refid: 'REF', time: Date.UTC(2026, 7, 1), type: 'deposit', asset: 'EUR', amount: '1000.0000', fee: '0' },
         { entryKey: 'W1', refid: 'RW1', time: Date.UTC(2026, 7, 2), type: 'withdrawal', asset: 'BTC', amount: '-0.5', fee: '0.0001' }
      ])
   })

   test('leaves out moving coins into a staking or parachain position', () => {

      const repository = new LedgerRepository('funding-staking')
      repository.upsertEntries([
         entry('P1', Date.UTC(2026, 7, 1), '50', { type: 'deposit', subtype: '', asset: 'DOT.P', baseAsset: 'DOT' }),
         entry('S1', Date.UTC(2026, 7, 2), '-2', { type: 'withdrawal', subtype: '', asset: 'ETH2.S', baseAsset: 'ETH' })
      ], Date.UTC(2026, 7, 4))

      expect(repository.fundingEntries()).toEqual([])
   })
})

describe('fundedAssetEntries', () => {

   test('lists every entry of an asset that was deposited or withdrawn, in any wallet, and of no other', () => {

      const repository = new LedgerRepository('funded-assets')
      repository.upsertEntries([
         entry('D1', Date.UTC(2026, 7, 1), '10', { type: 'deposit', subtype: '', asset: 'DOT', baseAsset: 'DOT' }),
         entry('E1', Date.UTC(2026, 7, 3), '0.5', { asset: 'DOT28.S', baseAsset: 'DOT', fee: '0.1' }),
         entry('T1', Date.UTC(2026, 7, 2), '-4', { type: 'trade', subtype: '', asset: 'DOT', baseAsset: 'DOT' }),
         entry('T2', Date.UTC(2026, 7, 2), '40', { type: 'trade', subtype: '', asset: 'ZUSD', baseAsset: 'USD' })
      ], Date.UTC(2026, 7, 4))

      expect(repository.fundedAssetEntries()).toEqual([
         { asset: 'DOT', time: Date.UTC(2026, 7, 1), amount: '10', fee: '0' },
         { asset: 'DOT', time: Date.UTC(2026, 7, 2), amount: '-4', fee: '0' },
         { asset: 'DOT', time: Date.UTC(2026, 7, 3), amount: '0.5', fee: '0.1' }
      ])
   })
})
