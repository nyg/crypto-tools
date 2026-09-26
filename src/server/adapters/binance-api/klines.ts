import type { BinanceKLine } from '../../../types/binance-api'
import type { UsdRateRow } from '../../../types/db'

export function usdRatesFromKLines({ asset, klines, today }: {
   asset: string
   klines: BinanceKLine[]
   today: number
}): UsdRateRow[] {

   const rows: UsdRateRow[] = []

   for (const [openTime, , , , close, baseVolume, , quoteVolume] of klines) {
      const base = Number(baseVolume)
      const rate = base > 0 ? Number(quoteVolume) / base : Number(close)
      if (openTime < today && Number.isFinite(rate) && rate > 0) {
         rows.push({ asset, day: openTime, rate, source: 'binance-daily' })
      }
   }

   return rows
}
