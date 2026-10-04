import Big from 'big.js'
import { ceilTo, floorTo } from './planner'
import type { PlanMarket } from './planner'
import type { OrderSide, SizeUnit } from '../../../types/portfolio'

export interface Book {
   bid: Big
   ask: Big
}

const HUNDRED = Big(100)

export const priceBound = (side: OrderSide, preview: Big, slippagePercent: Big, tick: Big): Big => side === 'buy'
   ? floorTo(preview.times(HUNDRED.plus(slippagePercent)).div(HUNDRED), tick)
   : ceilTo(preview.times(HUNDRED.minus(slippagePercent)).div(HUNDRED), tick)

export function restingPrice(side: OrderSide, { bid, ask }: Book, tick: Big, bound: Big): Big | null {

   if (bid.lte(0) || ask.lte(0)) return null

   if (side === 'buy') {
      const underAsk = tick.gt(0) ? floorTo(ask.minus(tick), tick) : bid
      const price = underAsk.gt(bound) ? bound : underAsk
      return price.gt(0) ? price : null
   }

   const overBid = tick.gt(0) ? ceilTo(bid.plus(tick), tick) : ask
   return overBid.lt(bound) ? bound : overBid
}

export const leftBehind = (side: OrderSide, resting: Big, desired: Big): boolean =>
   side === 'buy' ? desired.gt(resting) : desired.lt(resting)

export function limitQuantity(unit: SizeUnit, remaining: Big, price: Big, market: PlanMarket): Big {
   const quantity = unit === 'base' ? remaining : remaining.div(price)
   const capped = market.maxQty.gt(0) && quantity.gt(market.maxQty) ? market.maxQty : quantity
   return floorTo(capped, market.baseStep)
}

export const limitFits = (market: PlanMarket, quantity: Big, price: Big): boolean =>
   quantity.gt(0) && quantity.gte(market.minQty) && quantity.times(price).gte(market.minAmount)
