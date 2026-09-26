import KrakenAPI from '../adapters/kraken-api/adapter'
import BinanceAPI from '../adapters/binance-api/adapter'
import FrankfurterAPI from '../adapters/frankfurter-api/adapter'
import RateRepository from '../db/rate-repository'
import { messageOf } from '../errors'
import type { AssetRangeRow } from '../../types/db'

export const DAY_MS = 86400000

export const DAILY_WINDOW_DAYS = 719

export const ECB_CURRENCIES = new Set(['EUR', 'GBP', 'CHF', 'CAD', 'JPY', 'AUD'])

export const LEGACY_USD_SYMBOLS: Record<string, string> = {
   POL: 'MATICUSDT'
}

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

export interface LegacyRateFetch {
   asset: string
   symbol: string
   from: number
   to: number
}

export interface RatePlan {
   kraken: KrakenRateFetch[]
   ecb: EcbRateFetch | null
   legacy: LegacyRateFetch[]
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
   const legacy: LegacyRateFetch[] = []
   const ecbAssets: string[] = []
   let ecbFrom = Infinity
   let ecbTo = -Infinity

   for (const range of ranges) {

      if (range.asset === 'USD' || range.asset === '') continue

      const from = dayOf(range.first)
      const to = Math.min(dayOf(range.last), today - DAY_MS)
      if (to < from) continue

      const covered = coverage.get(range.asset)
      const reachesBack = covered !== undefined && covered.first <= from
      const missingFrom = reachesBack ? covered.last + DAY_MS : from
      if (missingFrom > to) continue

      const symbol = LEGACY_USD_SYMBOLS[range.asset]
      if (symbol && !reachesBack) legacy.push({ asset: range.asset, symbol, from, to })

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
      ecb: ecbAssets.length > 0 ? { assets: ecbAssets, from: ecbFrom, to: ecbTo } : null,
      legacy
   }
}

export function planFor(ranges: AssetRangeRow[], today = dayOf(Date.now())): RatePlan {
   return planRateFetch(ranges, new RateRepository().coverage(ranges.map(range => range.asset)), today)
}

const isEmpty = (plan: RatePlan) => plan.kraken.length === 0 && !plan.ecb && plan.legacy.length === 0

export async function backfillUsdRates(ranges: AssetRangeRow[], progress: BackfillProgress, today = dayOf(Date.now())): Promise<void> {
   await fetchPlannedRates(planFor(ranges, today), progress, today)
}

const quietProgress: BackfillProgress = {
   checkCancelled: () => {},
   onFetching: () => {},
   onStored: () => {},
   onSkipped: (asset, error) => {
      if (error) console.warn('No USD rates for', asset, error)
   }
}

const refreshes = new Map<string, Promise<void>>()
const refreshed = new Set<string>()

export function refreshUsdRates(accountId: string, ranges: () => AssetRangeRow[]): boolean {

   if (refreshes.has(accountId)) return true
   if (refreshed.has(accountId)) return false

   const today = dayOf(Date.now())
   const plan = planFor(ranges(), today)

   if (isEmpty(plan)) {
      refreshed.add(accountId)
      return false
   }

   refreshes.set(accountId, fetchPlannedRates(plan, quietProgress, today)
      .catch(error => console.warn('USD rate refresh failed:', messageOf(error)))
      .finally(() => {
         refreshes.delete(accountId)
         refreshed.add(accountId)
      }))

   return true
}

async function fetchPlannedRates(plan: RatePlan, progress: BackfillProgress, today: number): Promise<void> {

   const repository = new RateRepository()

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

   if (plan.kraken.length > 0) {

      progress.checkCancelled()
      progress.onFetching()

      const krakenAPI = new KrakenAPI()
      const pairs = await krakenAPI.fetchUsdPairs(plan.kraken.map(fetch => fetch.asset))

      for (const fetch of plan.kraken) {

         progress.checkCancelled()

         const pair = pairs.get(fetch.asset)
         if (!pair) {
            if (!LEGACY_USD_SYMBOLS[fetch.asset]) progress.onSkipped(fetch.asset, null)
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

   for (const fetch of plan.legacy) {

      progress.checkCancelled()

      const krakenFirst = repository.coverage([fetch.asset]).get(fetch.asset)?.first
      const to = Math.min(fetch.to, krakenFirst === undefined ? fetch.to : krakenFirst - DAY_MS)
      if (to < fetch.from) continue

      progress.onFetching()

      try {
         const rows = await new BinanceAPI().fetchUsdRateHistory({ ...fetch, to, today })
         progress.onStored(repository.insertMissingRates(rows))
      }
      catch (error) {
         progress.onSkipped(fetch.asset, `${fetch.asset} (${fetch.symbol}): ${messageOf(error)}`)
      }
   }
}
