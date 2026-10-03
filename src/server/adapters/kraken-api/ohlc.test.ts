import { describe, expect, test } from 'bun:test'
import { DAY_MS, candlesOf, mondayWeeks, spotCandles, usdRatesFromCandles } from './ohlc'
import type { KrakenOhlcCandle } from '../../../types/kraken-api'
import type { SpotCandle } from '../../../types/portfolio'

const seconds = (time: number) => time / 1000

const candle = (day: number, { close = '10', vwap = '12', volume = '5' } = {}): KrakenOhlcCandle =>
   [seconds(day), '9', '13', '8', close, vwap, volume, 3]

const today = Date.UTC(2026, 8, 25)

describe('candlesOf', () => {

   test('reads the one series next to the last cursor', () => {
      const series = [candle(Date.UTC(2026, 8, 1))]
      expect(candlesOf({ DOTUSD: series, last: 1790208000 })).toEqual(series)
      expect(candlesOf(undefined)).toEqual([])
   })
})

describe('spotCandles', () => {

   test('keeps the high, the low and the close of each candle, timed in milliseconds', () => {
      const day = Date.UTC(2026, 8, 1)
      expect(spotCandles([candle(day)])).toEqual([{ time: day, high: '13', low: '8', close: '10' }])
   })
})

describe('mondayWeeks', () => {

   const monday = Date.UTC(2026, 8, 7)

   const day = (offset: number, high: string, low: string, close: string): SpotCandle =>
      ({ time: monday + offset * DAY_MS, high, low, close })

   test('folds the days from Monday to Sunday into one candle', () => {

      const weeks = mondayWeeks([
         day(0, '13', '9', '12'), day(1, '15', '11', '14'), day(2, '14', '7', '8'), day(3, '10', '8', '9'),
         day(4, '11', '9', '10'), day(5, '12', '10', '11'), day(6, '12', '10', '11.5')
      ])

      expect(weeks).toEqual([{ time: monday, high: '15', low: '7', close: '11.5' }])
   })

   test('keeps the week a coin was listed in and the week still forming, short as they are', () => {

      const weeks = mondayWeeks([
         day(-2, '99', '1', '50'), day(-1, '98', '2', '51'),
         ...Array.from({ length: 7 }, (_, offset) => day(offset, '13', '9', '12')),
         day(7, '20', '18', '19'), day(8, '22', '17', '21')
      ])

      expect(weeks).toEqual([
         { time: monday - 7 * DAY_MS, high: '99', low: '1', close: '51' },
         { time: monday, high: '13', low: '9', close: '12' },
         { time: monday + 7 * DAY_MS, high: '22', low: '17', close: '21' }
      ])
   })
})

describe('usdRatesFromCandles', () => {

   test('prices a day at its volume-weighted average, and at the close when nothing traded', () => {

      const rows = usdRatesFromCandles({
         asset: 'DOT',
         daily: [candle(Date.UTC(2026, 8, 1)), candle(Date.UTC(2026, 8, 2), { vwap: '0', volume: '0' })],
         weekly: [],
         inverse: false,
         today
      })

      expect(rows).toEqual([
         { asset: 'DOT', day: Date.UTC(2026, 8, 1), rate: 12, source: 'kraken-daily' },
         { asset: 'DOT', day: Date.UTC(2026, 8, 2), rate: 10, source: 'kraken-daily' }
      ])
   })

   test('never stores the day that has not finished', () => {

      const rows = usdRatesFromCandles({
         asset: 'DOT', daily: [candle(today - DAY_MS), candle(today)], weekly: [], inverse: false, today
      })

      expect(rows.map(row => row.day)).toEqual([today - DAY_MS])
   })

   test('spreads a weekly candle over its seven days, and stops where the daily candles start', () => {

      const week = Date.UTC(2024, 0, 4)
      const firstDaily = week + 10 * DAY_MS

      const rows = usdRatesFromCandles({
         asset: 'DOT',
         daily: [candle(firstDaily, { vwap: '20' })],
         weekly: [candle(week, { vwap: '5' }), candle(week + 7 * DAY_MS, { vwap: '6' })],
         inverse: false,
         today
      })

      expect(rows.filter(row => row.source === 'kraken-weekly').map(row => [row.day, row.rate])).toEqual([
         ...Array.from({ length: 7 }, (_, index) => [week + index * DAY_MS, 5]),
         ...Array.from({ length: 3 }, (_, index) => [week + (7 + index) * DAY_MS, 6])
      ])
      expect(rows.at(-1)).toEqual({ asset: 'DOT', day: firstDaily, rate: 20, source: 'kraken-daily' })
   })

   test('inverts a pair quoted with USD as its base', () => {

      const [row] = usdRatesFromCandles({
         asset: 'CAD', daily: [candle(Date.UTC(2026, 8, 1), { vwap: '1.25' })], weekly: [], inverse: true, today
      })

      expect(row?.rate).toBe(0.8)
   })
})
