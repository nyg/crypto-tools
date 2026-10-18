import Big from 'big.js'
import { makerPrice } from '../portfolio/limit-orders'
import { floorTo } from '../portfolio/planner'
import type { PlanMarket } from '../portfolio/planner'
import type { InstantOrderFill, InstantOrderStatus } from '../../../types/api'
import type { FeeAmount, OrderSettlement, OrderSide, SizeUnit } from '../../../types/portfolio'

export type Sizing = { price: Big, quantity: Big } | { refusal: string }

const below = (market: PlanMarket) =>
   `Below the ${market.symbol} minimum of ${market.minQty} ${market.base} and ${market.minAmount} ${market.quote}.`

export function sizeRest(quantity: Big, price: Big, market: PlanMarket): Sizing {
   const floored = floorTo(quantity, market.baseStep)
   const total = floored.times(price)
   if (floored.lte(0) || floored.lt(market.minQty) || total.lt(market.minAmount)) return { refusal: below(market) }
   if ((market.maxQty.gt(0) && floored.gt(market.maxQty)) || (market.maxAmount.gt(0) && total.gt(market.maxAmount))) {
      return { refusal: `Above the ${market.symbol} maximum of ${market.maxQty} ${market.base} per order.` }
   }
   return { price, quantity: floored }
}

export function sizeInstantOrder(side: OrderSide, unit: SizeUnit, amount: Big, market: PlanMarket): Sizing {
   const price = makerPrice(side, market, market.tickStep)
   if (!price) return { refusal: `The ${market.symbol} book has no ${side === 'buy' ? 'ask' : 'bid'} to price the order from.` }
   return sizeRest(unit === 'base' ? amount : amount.div(price), price, market)
}

export const maxBuy = (freeQuote: Big, makerRate: Big, feeInQuote: boolean, quoteStep: Big): Big =>
   floorTo(feeInQuote ? freeQuote.div(Big(1).plus(makerRate)) : freeQuote, quoteStep)

export interface Fill {
   base: Big
   quote: Big
   fees: Map<string, Big>
}

export const noFill = (): Fill => ({ base: Big(0), quote: Big(0), fees: new Map() })

export function addFill(fill: Fill, settlement: Pick<OrderSettlement, 'base' | 'quote' | 'fees'>): Fill {
   const fees = new Map(fill.fees)
   for (const [asset, amount] of Object.entries(settlement.fees)) fees.set(asset, (fees.get(asset) ?? Big(0)).plus(amount || 0))
   return { base: fill.base.plus(settlement.base || 0), quote: fill.quote.plus(settlement.quote || 0), fees }
}

const feeList = (fees: Map<string, Big>): FeeAmount[] =>
   [...fees].map(([asset, amount]) => ({ asset, amount: amount.toFixed() }))

export const wireFill = ({ base, quote, fees }: Fill): InstantOrderFill =>
   ({ base: base.toFixed(), quote: quote.toFixed(), fees: feeList(fees) })

export const fillOf = ({ base, quote, fees }: InstantOrderFill): Fill =>
   addFill(noFill(), { base, quote, fees: Object.fromEntries(fees.map(({ asset, amount }) => [asset, amount])) })

export const summaryOf = (fill: Fill) => ({
   filled: fill.base.toFixed(),
   averagePrice: fill.base.gt(0) ? fill.quote.div(fill.base).toFixed() : '0',
   fees: feeList(fill.fees)
})

export const closedStatus = (quantity: Big, filled: Big): InstantOrderStatus =>
   filled.gte(quantity) ? 'filled' : filled.gt(0) ? 'partial' : 'cancelled'
