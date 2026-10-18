import Big from 'big.js'
import { makerPrice } from '../portfolio/limit-orders'
import { floorTo } from '../portfolio/planner'
import type { PlanMarket } from '../portfolio/planner'
import type { InstantOrderState } from '../../../types/api'
import type { OrderSettlement, OrderSide, SizeUnit } from '../../../types/portfolio'

export type Sizing = { price: Big, quantity: Big } | { refusal: string }

export function sizeInstantOrder(side: OrderSide, unit: SizeUnit, amount: Big, market: PlanMarket): Sizing {

   const price = makerPrice(side, market, market.tickStep)
   if (!price) return { refusal: `The ${market.symbol} book has no ${side === 'buy' ? 'ask' : 'bid'} to price the order from.` }

   const quantity = floorTo(unit === 'base' ? amount : amount.div(price), market.baseStep)
   const total = quantity.times(price)

   if (quantity.lte(0) || quantity.lt(market.minQty) || total.lt(market.minAmount)) {
      return { refusal: `Below the ${market.symbol} minimum of ${market.minQty} ${market.base} and ${market.minAmount} ${market.quote}.` }
   }
   if ((market.maxQty.gt(0) && quantity.gt(market.maxQty)) || (market.maxAmount.gt(0) && total.gt(market.maxAmount))) {
      return { refusal: `Above the ${market.symbol} maximum of ${market.maxQty} ${market.base} per order.` }
   }

   return { price, quantity }
}

export const maxBuy = (freeQuote: Big, makerRate: Big, feeInQuote: boolean, quoteStep: Big): Big =>
   floorTo(feeInQuote ? freeQuote.div(Big(1).plus(makerRate)) : freeQuote, quoteStep)

const WOULD_TAKE = 'Cancelled by the exchange: at that price it would have taken liquidity.'

export function stateOf(settlement: OrderSettlement | null, reason = ''): InstantOrderState {

   if (!settlement) return { orderId: null, status: 'unknown', filled: '0', averagePrice: '0', fees: [], reason }

   const filled = Big(settlement.base || 0)
   const status = settlement.status === 'open' || settlement.status === 'filled' ? settlement.status
      : filled.gt(0) ? 'partial' : 'cancelled'

   return {
      orderId: settlement.orderId || null,
      status,
      filled: filled.toFixed(),
      averagePrice: settlement.averagePrice || '0',
      fees: Object.entries(settlement.fees).map(([asset, amount]) => ({ asset, amount })),
      reason: settlement.postOnlyRefused ? WOULD_TAKE : settlement.reason
   }
}
