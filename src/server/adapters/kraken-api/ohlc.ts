import type { KrakenOhlc, KrakenOhlcCandle } from '../../../types/kraken-api'
import type { UsdRateRow } from '../../../types/db'

export const DAY_MS = 86400000

export const DAILY_INTERVAL = 1440
export const WEEKLY_INTERVAL = 10080

const WEEK_DAYS = 7

export function candlesOf(ohlc: KrakenOhlc | undefined): KrakenOhlcCandle[] {
   const series = Object.entries(ohlc ?? {})
      .find((entry): entry is [string, KrakenOhlcCandle[]] => entry[0] !== 'last' && Array.isArray(entry[1]))
   return series?.[1] ?? []
}

function priceOf(candle: KrakenOhlcCandle): number | null {
   const [, , , , close, vwap, volume] = candle
   const price = Number(Number(volume) > 0 ? vwap : close)
   return Number.isFinite(price) && price > 0 ? price : null
}

export function usdRatesFromCandles({ asset, daily, weekly, inverse, today }: {
   asset: string
   daily: KrakenOhlcCandle[]
   weekly: KrakenOhlcCandle[]
   inverse: boolean
   today: number
}): UsdRateRow[] {

   const rateOf = (candle: KrakenOhlcCandle) => {
      const price = priceOf(candle)
      if (price === null) return null
      return inverse ? 1 / price : price
   }

   const rows = new Map<number, UsdRateRow>()

   for (const candle of daily) {
      const day = candle[0] * 1000
      const rate = rateOf(candle)
      if (rate !== null && day < today) rows.set(day, { asset, day, rate, source: 'kraken-daily' })
   }

   const firstDaily = daily.length > 0 ? Math.min(...daily.map(candle => candle[0] * 1000)) : today

   for (const candle of weekly) {
      const rate = rateOf(candle)
      if (rate === null) continue

      for (let offset = 0; offset < WEEK_DAYS; offset++) {
         const day = candle[0] * 1000 + offset * DAY_MS
         if (day >= firstDaily || day >= today) break
         rows.set(day, { asset, day, rate, source: 'kraken-weekly' })
      }
   }

   return [...rows.values()].toSorted((a, b) => a.day - b.day)
}
