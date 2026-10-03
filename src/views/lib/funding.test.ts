import { describe, expect, test } from 'bun:test'
import { fundingAssets, fundingBuckets, fundingTotals } from './funding'
import type { FundingMovement } from '../../types/api'

const movement = (id: string, time: number, changes: Partial<FundingMovement> = {}): FundingMovement => ({
   id, kind: 'deposit', asset: 'EUR', amount: '100', fee: '0', method: '', time, pending: false, ...changes
})

const movements = [
   movement('a', Date.UTC(2025, 2, 3, 8), { amount: '1000', fee: '1.5' }),
   movement('b', Date.UTC(2025, 2, 3, 23, 59), { amount: '250.25' }),
   movement('c', Date.UTC(2025, 2, 3, 12), { kind: 'withdrawal', amount: '400', fee: '0.1' }),
   movement('d', Date.UTC(2025, 11, 31, 23), { kind: 'withdrawal', amount: '0.1' }),
   movement('e', Date.UTC(2026, 0, 1), { amount: '0.2' })
]

describe('fundingAssets', () => {

   test('lists the asset that moved most often first, then by name', () => {
      expect(fundingAssets([
         movement('1', 1, { asset: 'ETH' }),
         movement('2', 2, { asset: 'BTC' }),
         movement('3', 3, { asset: 'EUR' }),
         movement('4', 4, { asset: 'EUR' })
      ])).toEqual([{ asset: 'EUR', count: 2 }, { asset: 'BTC', count: 1 }, { asset: 'ETH', count: 1 }])
   })
})

describe('fundingTotals', () => {

   test('adds up each side exactly, the net being deposited less withdrawn', () => {
      expect(fundingTotals(movements)).toEqual({ deposited: '1250.45', withdrawn: '400.1', net: '850.35', fees: '1.6' })
   })

   test('goes negative when more left than came in', () => {
      expect(fundingTotals([movement('w', 1, { kind: 'withdrawal', amount: '0.3' }), movement('d', 2, { amount: '0.1' })]).net)
         .toBe('-0.2')
   })

   test('is zero for nothing', () => {
      expect(fundingTotals([])).toEqual({ deposited: '0', withdrawn: '0', net: '0', fees: '0' })
   })
})

describe('fundingBuckets', () => {

   test('sums the movements of one UTC day and has no bucket for a day nothing moved', () => {
      expect(fundingBuckets(movements, 'day')).toEqual([
         { start: Date.UTC(2025, 2, 3), deposited: 1250.25, withdrawn: -400, net: 850.25, count: 3 },
         { start: Date.UTC(2025, 11, 31), deposited: 0, withdrawn: -0.1, net: 850.15, count: 1 },
         { start: Date.UTC(2026, 0, 1), deposited: 0.2, withdrawn: 0, net: 850.35, count: 1 }
      ])
   })

   test('folds the same movements into UTC months and years', () => {
      expect(fundingBuckets(movements, 'month').map(({ start, count }) => ({ start, count }))).toEqual([
         { start: Date.UTC(2025, 2, 1), count: 3 },
         { start: Date.UTC(2025, 11, 1), count: 1 },
         { start: Date.UTC(2026, 0, 1), count: 1 }
      ])
      expect(fundingBuckets(movements, 'year')).toEqual([
         { start: Date.UTC(2025, 0, 1), deposited: 1250.25, withdrawn: -400.1, net: 850.15, count: 4 },
         { start: Date.UTC(2026, 0, 1), deposited: 0.2, withdrawn: 0, net: 850.35, count: 1 }
      ])
   })

   test('orders the buckets by time whatever order the movements come in', () => {
      expect(fundingBuckets(movements.toReversed(), 'day').map(({ start }) => start))
         .toEqual([Date.UTC(2025, 2, 3), Date.UTC(2025, 11, 31), Date.UTC(2026, 0, 1)])
   })
})
