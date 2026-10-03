import { describe, expect, test } from 'bun:test'
import { candlesFromKlines } from './klines'
import type { BybitKline } from '../../../types/bybit-api'

const kline = (time: number, high: string, low: string, close: string): BybitKline =>
   [String(time), '1', high, low, close, '10', '20']

describe('candlesFromKlines', () => {

   test('turns the newest-first list into candles oldest first', () => {

      const first = Date.UTC(2026, 8, 1)
      const second = Date.UTC(2026, 8, 2)

      const candles = candlesFromKlines([kline(second, '14', '9', '12'), kline(first, '13', '8', '10')])

      expect(candles).toEqual([
         { time: first, high: '13', low: '8', close: '10' },
         { time: second, high: '14', low: '9', close: '12' }
      ])
   })
})
