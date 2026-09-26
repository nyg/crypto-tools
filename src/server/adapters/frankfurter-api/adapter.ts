import * as resource from './resource'
import type { FrankfurterRate } from '../../../types/frankfurter-api'
import type { UsdRateRow } from '../../../types/db'

const DAY_MS = 86400000

const MAX_FILLED_DAYS = 7

const isoDate = (time: number) => new Date(time).toISOString().slice(0, 10)

const utcDay = (date: string) => Date.parse(`${date}T00:00:00Z`)

export function usdRatesFromEcb(rates: FrankfurterRate[], today: number): UsdRateRow[] {

   const byAsset = new Map<string, Map<number, number>>()

   for (const entry of rates) {
      const day = utcDay(entry.date)
      if (entry.base !== 'USD' || !Number.isFinite(day) || !(entry.rate > 0)) continue
      const days = byAsset.get(entry.quote) ?? new Map<number, number>()
      days.set(day, 1 / entry.rate)
      byAsset.set(entry.quote, days)
   }

   const rows: UsdRateRow[] = []

   for (const [asset, days] of byAsset) {

      const sorted = [...days].toSorted(([a], [b]) => a - b)

      for (const [index, [day, rate]] of sorted.entries()) {
         const next = sorted[index + 1]?.[0] ?? day + DAY_MS
         const until = Math.min(next, day + MAX_FILLED_DAYS * DAY_MS, today)
         for (let filled = day; filled < until; filled += DAY_MS) {
            rows.push({ asset, day: filled, rate, source: 'ecb' })
         }
      }
   }

   return rows
}

export default class FrankfurterAPI {

   async fetchUsdRates({ assets, from, to, today }: {
      assets: string[]
      from: number
      to: number
      today: number
   }): Promise<UsdRateRow[]> {

      if (assets.length === 0 || to < from) return []

      const rates = await resource.fetchRates({ from: isoDate(from), to: isoDate(to), base: 'USD', quotes: assets })
      return usdRatesFromEcb(rates, today)
   }
}
