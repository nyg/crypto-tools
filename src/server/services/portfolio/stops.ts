import Big from 'big.js'
import { floorTo, sellFits } from './planner'
import type { PlanMarket } from './planner'
import type { StopSkipReason } from '../../../types/portfolio'

export interface StopCandidate {
   asset: string
   stopPrice: Big
   holding: Big
   market: PlanMarket | undefined
}

export interface DesiredStop {
   asset: string
   symbol: string
   quantity: Big
   triggerPrice: Big
}

export interface SkippedStop {
   asset: string
   reason: StopSkipReason
}

export interface LiveStop {
   orderLinkId: string
   asset: string
   symbol: string
   quantity: Big
   triggerPrice: Big
}

export interface StopActions {
   cancel: LiveStop[]
   place: DesiredStop[]
   keep: LiveStop[]
}

export const stopQuantity = (holding: Big, market: PlanMarket): Big => floorTo(holding, market.baseStep)

export const stopTrigger = (stopPrice: Big, market: PlanMarket): Big => floorTo(stopPrice, market.tickStep)

export function planStops(candidates: StopCandidate[]): { desired: DesiredStop[], skipped: SkippedStop[] } {

   const desired: DesiredStop[] = []
   const skipped: SkippedStop[] = []

   for (const { asset, stopPrice, holding, market } of candidates) {
      if (!market) {
         skipped.push({ asset, reason: 'no-market' })
         continue
      }

      const triggerPrice = stopTrigger(stopPrice, market)
      if (triggerPrice.lte(0) || (market.last.gt(0) && triggerPrice.gte(market.last))) {
         skipped.push({ asset, reason: 'above-price' })
         continue
      }

      const quantity = stopQuantity(holding, market)
      if (!sellFits(market, quantity)) {
         skipped.push({ asset, reason: 'too-small' })
         continue
      }

      desired.push({ asset, symbol: market.symbol, quantity, triggerPrice })
   }

   return { desired, skipped }
}

export function stopActions(desired: DesiredStop[], live: LiveStop[]): StopActions {

   const wanted = new Map(desired.map(stop => [stop.asset, stop]))
   const cancel: LiveStop[] = []
   const keep: LiveStop[] = []
   const matched = new Set<string>()

   for (const stop of live) {
      const target = wanted.get(stop.asset)
      const same = target !== undefined && !matched.has(stop.asset)
         && target.symbol === stop.symbol
         && target.quantity.eq(stop.quantity)
         && target.triggerPrice.eq(stop.triggerPrice)

      if (same) {
         matched.add(stop.asset)
         keep.push(stop)
      }
      else cancel.push(stop)
   }

   return { cancel, keep, place: desired.filter(({ asset }) => !matched.has(asset)) }
}
