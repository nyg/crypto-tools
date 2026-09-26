import { describe, expect, test } from 'bun:test'
import { usdRatesFromEcb } from './adapter'

const DAY = 86400000

describe('usdRatesFromEcb', () => {

   test('turns a rate per US dollar into the dollar value of one unit, on its UTC day', () => {

      const rows = usdRatesFromEcb([
         { date: '2026-08-03', base: 'USD', quote: 'EUR', rate: 0.8 },
         { date: '2026-08-03', base: 'USD', quote: 'CHF', rate: 0.5 }
      ], Date.UTC(2026, 8, 1))

      expect(rows).toEqual([
         { asset: 'EUR', day: Date.UTC(2026, 7, 3), rate: 1.25, source: 'ecb' },
         { asset: 'CHF', day: Date.UTC(2026, 7, 3), rate: 2, source: 'ecb' }
      ])
   })

   test('carries a rate over the days nothing was published, and never into today', () => {

      const today = Date.UTC(2026, 7, 11)

      const rows = usdRatesFromEcb([
         { date: '2026-08-07', base: 'USD', quote: 'EUR', rate: 0.8 },
         { date: '2026-08-10', base: 'USD', quote: 'EUR', rate: 0.5 },
         { date: '2026-08-11', base: 'USD', quote: 'EUR', rate: 0.4 }
      ], today)

      expect(rows.map(row => [row.day, row.rate])).toEqual([
         [Date.UTC(2026, 7, 7), 1.25],
         [Date.UTC(2026, 7, 7) + DAY, 1.25],
         [Date.UTC(2026, 7, 7) + 2 * DAY, 1.25],
         [Date.UTC(2026, 7, 10), 2]
      ])
   })
})
