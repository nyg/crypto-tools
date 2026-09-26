import { describe, expect, test } from 'bun:test'
import { DAILY_WINDOW_DAYS, DAY_MS, planRateFetch } from './usd-rate-backfill'
import type { AssetRangeRow } from '../../types/db'

const today = Date.UTC(2026, 8, 25)

const range = (asset: string, first: number, last: number): AssetRangeRow => ({ asset, first, last })

const coverageOf = (...rows: AssetRangeRow[]) => new Map(rows.map(row => [row.asset, row]))

describe('planRateFetch', () => {

   test('asks for daily and weekly candles when nothing is stored and the range is older than the daily window', () => {

      const plan = planRateFetch([range('DOT', Date.UTC(2021, 0, 5, 10), Date.UTC(2026, 8, 20, 10))], new Map(), today)

      expect(plan).toEqual({ kraken: [{ asset: 'DOT', since: 0, weekly: true }], ecb: null })
   })

   test('asks only for the days after the last stored one', () => {

      const lastStored = Date.UTC(2026, 8, 10)

      const plan = planRateFetch(
         [range('DOT', Date.UTC(2021, 0, 5), Date.UTC(2026, 8, 20))],
         coverageOf(range('DOT', Date.UTC(2021, 0, 5), lastStored)),
         today)

      expect(plan.kraken).toEqual([{ asset: 'DOT', since: lastStored, weekly: false }])
   })

   test('asks for nothing once every day up to the last entry is stored', () => {

      const plan = planRateFetch(
         [range('DOT', Date.UTC(2025, 0, 5), Date.UTC(2026, 8, 20, 18))],
         coverageOf(range('DOT', Date.UTC(2025, 0, 1), Date.UTC(2026, 8, 20))),
         today)

      expect(plan).toEqual({ kraken: [], ecb: null })
   })

   test('leaves entries from today until the day is over', () => {

      const plan = planRateFetch([range('DOT', today + 3600000, today + 7200000)], new Map(), today)

      expect(plan.kraken).toEqual([])
   })

   test('keeps a range inside the daily window off the weekly candles', () => {

      const first = today - (DAILY_WINDOW_DAYS - 10) * DAY_MS

      const plan = planRateFetch([range('ETH', first, today - DAY_MS)], new Map(), today)

      expect(plan.kraken).toEqual([{ asset: 'ETH', since: first - DAY_MS, weekly: false }])
   })

   test('sends fiat to the ECB in one request over every missing day, and skips USD', () => {

      const plan = planRateFetch([
         range('EUR', Date.UTC(2019, 3, 2), Date.UTC(2026, 8, 1)),
         range('CHF', Date.UTC(2018, 1, 1), Date.UTC(2026, 5, 1)),
         range('USD', Date.UTC(2017, 1, 1), Date.UTC(2026, 8, 1))
      ], coverageOf(range('EUR', Date.UTC(2019, 3, 2), Date.UTC(2026, 6, 1))), today)

      expect(plan).toEqual({
         kraken: [],
         ecb: { assets: ['EUR', 'CHF'], from: Date.UTC(2018, 1, 1), to: Date.UTC(2026, 8, 1) }
      })
   })
})
