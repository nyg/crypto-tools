import KrakenAPI from '../adapters/kraken-api/adapter'
import FrankfurterAPI from '../adapters/frankfurter-api/adapter'
import RateRepository from '../db/rate-repository'
import { messageOf } from '../errors'
import type { AssetRangeRow } from '../../types/db'

export const DAY_MS = 86400000

export const DAILY_WINDOW_DAYS = 719

export const ECB_CURRENCIES = new Set(['EUR', 'GBP', 'CHF', 'CAD', 'JPY', 'AUD'])

export interface KrakenRateFetch {
   asset: string
   since: number
   weekly: boolean
}

export interface EcbRateFetch {
   assets: string[]
   from: number
   to: number
}

export interface RatePlan {
   kraken: KrakenRateFetch[]
   ecb: EcbRateFetch | null
}

export interface BackfillProgress {
   checkCancelled: () => void
   onFetching: () => void
   onStored: (received: number) => void
   onSkipped: (asset: string, error: string | null) => void
}

export const dayOf = (time: number) => time - (time % DAY_MS)

export function planRateFetch(ranges: AssetRangeRow[], coverage: Map<string, AssetRangeRow>, today: number): RatePlan {

   const dailyWindow = today - DAILY_WINDOW_DAYS * DAY_MS
   const kraken: KrakenRateFetch[] = []
   const ecbAssets: string[] = []
   let ecbFrom = Infinity
   let ecbTo = -Infinity

   for (const range of ranges) {

      if (range.asset === 'USD' || range.asset === '') continue

      const from = dayOf(range.first)
      const to = Math.min(dayOf(range.last), today - DAY_MS)
      if (to < from) continue

      const covered = coverage.get(range.asset)
      const missingFrom = covered && covered.first <= from ? covered.last + DAY_MS : from
      if (missingFrom > to) continue

      if (ECB_CURRENCIES.has(range.asset)) {
         ecbAssets.push(range.asset)
         ecbFrom = Math.min(ecbFrom, missingFrom)
         ecbTo = Math.max(ecbTo, to)
         continue
      }

      const weekly = missingFrom < dailyWindow
      kraken.push({ asset: range.asset, since: weekly ? 0 : missingFrom - DAY_MS, weekly })
   }

   return {
      kraken,
      ecb: ecbAssets.length > 0 ? { assets: ecbAssets, from: ecbFrom, to: ecbTo } : null
   }
}

export async function backfillUsdRates(ranges: AssetRangeRow[], progress: BackfillProgress, today = dayOf(Date.now())): Promise<void> {

   const repository = new RateRepository()
   const plan = planRateFetch(ranges, repository.coverage(ranges.map(range => range.asset)), today)

   if (plan.ecb) {
      progress.checkCancelled()
      progress.onFetching()
      try {
         const rows = await new FrankfurterAPI().fetchUsdRates({ ...plan.ecb, today })
         progress.onStored(repository.upsertRates(rows))
      }
      catch (error) {
         for (const asset of plan.ecb.assets) progress.onSkipped(asset, `ECB rates: ${messageOf(error)}`)
      }
   }

   if (plan.kraken.length === 0) return

   progress.checkCancelled()
   progress.onFetching()

   const krakenAPI = new KrakenAPI()
   const pairs = await krakenAPI.fetchUsdPairs(plan.kraken.map(fetch => fetch.asset))

   for (const fetch of plan.kraken) {

      progress.checkCancelled()

      const pair = pairs.get(fetch.asset)
      if (!pair) {
         progress.onSkipped(fetch.asset, null)
         continue
      }

      try {
         const rows = await krakenAPI.fetchUsdRateHistory({ ...fetch, pair, today })
         progress.onStored(repository.upsertRates(rows))
      }
      catch (error) {
         progress.onSkipped(fetch.asset, `${fetch.asset}: ${messageOf(error)}`)
      }
   }
}
