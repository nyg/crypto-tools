import { describe, expect, test } from 'bun:test'
import { supertrend } from './supertrend'
import type { SpotCandle } from '../../../types/portfolio'

const DAY_MS = 86400000

const candle = (high: number, low: number, close: number): SpotCandle =>
   ({ time: 0, high: String(high), low: String(low), close: String(close) })

const falling = (count: number): SpotCandle[] =>
   Array.from({ length: count }, (_, index) => candle(305 - 10 * index, 295 - 10 * index, 296 - 10 * index))

const daily = (candles: SpotCandle[]): SpotCandle[] => candles.map((entry, index) => ({ ...entry, time: index * DAY_MS }))

const breakout = candle(260, 200, 255)
const higher = candle(250, 240, 245)
const pullback = candle(235, 225, 230)
const breakdown = candle(200, 150, 160)

const levelOf = (candles: SpotCandle[], now = Infinity) => {
   const level = supertrend(daily(candles), { now })
   return level && { flipPrice: level.flipPrice.toFixed(), trend: level.trend }
}

const duringLast = (candles: SpotCandle[]) => (candles.length - 0.5) * DAY_MS

describe('supertrend', () => {

   test('has no value until there are more candles than the ATR length', () => {
      expect(supertrend(falling(10))).toBeNull()
      expect(supertrend([])).toBeNull()
   })

   test('starts as a downtrend on the upper band, three ATRs above the middle of the bar', () => {
      expect(levelOf(falling(11))).toEqual({ flipPrice: '232.73', trend: 'down' })
   })

   test('follows the forming candle, and lowers the upper band as the price falls', () => {
      expect(levelOf(falling(12))).toEqual({ flipPrice: '222.757', trend: 'down' })
   })

   test('flips up on a close above the upper band, onto the lower band', () => {
      expect(levelOf([...falling(12), breakout])).toEqual({ flipPrice: '178.3187', trend: 'up' })
   })

   test('raises the lower band with the price and holds it through a pullback', () => {
      expect(levelOf([...falling(12), breakout, higher])).toEqual({ flipPrice: '193.98683', trend: 'up' })
      expect(levelOf([...falling(12), breakout, higher, pullback])).toEqual({ flipPrice: '193.98683', trend: 'up' })
   })

   test('flips down on a close below the lower band, onto the upper band', () => {
      expect(levelOf([...falling(12), breakout, higher, pullback, breakdown]))
         .toEqual({ flipPrice: '245.7206677', trend: 'down' })
   })

   test('keeps the trend while the candle past the band is still forming, and flips once it has closed', () => {
      const brokenOut = [...falling(12), breakout]
      const brokenDown = [...falling(12), breakout, higher, pullback, breakdown]

      expect(levelOf(brokenOut, duringLast(brokenOut))).toEqual({ flipPrice: '222.757', trend: 'down' })
      expect(levelOf(brokenDown, duringLast(brokenDown))).toEqual({ flipPrice: '193.98683', trend: 'up' })
      expect(levelOf(brokenDown, duringLast(brokenDown) + DAY_MS)).toEqual({ flipPrice: '245.7206677', trend: 'down' })
   })

   test('lets the forming candle move the band of the trend it is in', () => {
      const candles = [...falling(12), breakout, higher]

      expect(levelOf(candles, duringLast(candles))).toEqual({ flipPrice: '193.98683', trend: 'up' })
   })

   test('reads a weekly candle as forming for seven days', () => {
      const weekly = [...falling(12), breakout].map((entry, index) => ({ ...entry, time: index * 7 * DAY_MS }))

      expect(supertrend(weekly, { interval: '1w', now: 12 * 7 * DAY_MS + 6 * DAY_MS })?.trend).toBe('down')
      expect(supertrend(weekly, { interval: '1w', now: 13 * 7 * DAY_MS })?.trend).toBe('up')
   })

   test('takes another ATR length and factor', () => {
      expect(supertrend(falling(3), { atrLength: 2, factor: 1 })?.flipPrice.toFixed()).toBe('290.75')
   })
})
