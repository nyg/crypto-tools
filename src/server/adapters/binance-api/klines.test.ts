import { describe, expect, test } from 'bun:test'
import { usdRatesFromKLines } from './klines'
import type { BinanceKLine } from '../../../types/binance-api'

const kline = (openTime: number, close: string, baseVolume: string, quoteVolume: string): BinanceKLine =>
   [openTime, '1', '1', '1', close, baseVolume, openTime + 86399999, quoteVolume, 10]

describe('usdRatesFromKLines', () => {

   test('prices a day at its volume-weighted average, at the close when nothing traded, and never today', () => {

      const today = Date.UTC(2023, 5, 3)

      const rows = usdRatesFromKLines({
         asset: 'POL',
         klines: [
            kline(Date.UTC(2023, 5, 1), '0.9', '100', '85'),
            kline(Date.UTC(2023, 5, 2), '0.8', '0', '0'),
            kline(today, '0.7', '10', '7')
         ],
         today
      })

      expect(rows).toEqual([
         { asset: 'POL', day: Date.UTC(2023, 5, 1), rate: 0.85, source: 'binance-daily' },
         { asset: 'POL', day: Date.UTC(2023, 5, 2), rate: 0.8, source: 'binance-daily' }
      ])
   })
})
