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

export function makerPrice(side: OrderSide, { bid, ask }: Book, tick: Big): Big | null {

   if (bid.lte(0) || ask.lte(0)) return null

   if (side === 'buy') {
      const underAsk = tick.gt(0) ? floorTo(ask.minus(tick), tick) : bid
      return underAsk.gt(0) ? underAsk : null
   }

   return tick.gt(0) ? ceilTo(bid.plus(tick), tick) : ask
}

export function restingPrice(side: OrderSide, book: Book, tick: Big, bound: Big): Big | null {
   const price = makerPrice(side, book, tick)
   if (!price) return null
   if (side === 'buy') return price.gt(bound) ? bound : price
   return price.lt(bound) ? bound : price
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
