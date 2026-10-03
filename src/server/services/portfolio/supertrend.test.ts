import { describe, expect, test } from 'bun:test'
import { supertrend } from './supertrend'
import type { SpotCandle } from '../../../types/portfolio'

const DAY_MS = 86400000

const candle = (high: number, low: number, close: number, index = 0): SpotCandle =>
   ({ time: index * DAY_MS, high: String(high), low: String(low), close: String(close) })

const falling = (count: number): SpotCandle[] =>
   Array.from({ length: count }, (_, index) => candle(305 - 10 * index, 295 - 10 * index, 296 - 10 * index, index))

const breakout = candle(260, 200, 255)
const higher = candle(250, 240, 245)
const pullback = candle(235, 225, 230)
const breakdown = candle(200, 150, 160)

const levelOf = (candles: SpotCandle[]) => {
   const level = supertrend(candles)
   return level && { flipPrice: level.flipPrice.toFixed(), trend: level.trend }
}

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

   test('takes another ATR length and factor', () => {
      expect(supertrend(falling(3), 2, 1)?.flipPrice.toFixed()).toBe('290.75')
   })
})
