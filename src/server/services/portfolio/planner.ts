import Big from 'big.js'
import type { OrderSide, SizeUnit, SkipReason } from '../../../types/portfolio'

export const DEFAULT_FEE_RATE = Big('0.001')

export interface PlanMarket {
   symbol: string
   base: string
   quote: string
   last: Big
   bid: Big
   ask: Big
   baseStep: Big
   quoteStep: Big
   tickStep: Big
   minQty: Big
   minAmount: Big
   maxQty: Big
   maxAmount: Big
}

export interface PlanInput {
   quote: string
   holdings: Map<string, Big>
   targets: Map<string, Big>
   markets: Map<string, PlanMarket>
   free: Map<string, Big>
   band: Big
   withdraw: Big | 'all'
   feeRate?: Big
}

export interface PlannedOrder {
   asset: string
   symbol: string
   side: OrderSide
   unit: SizeUnit
   amount: Big
   price: Big
   value: Big
}

export interface SkippedAsset {
   asset: string
   reason: SkipReason
   value: Big
}

export interface Plan {
   total: Big
   withdraw: Big
   reserve: Big
   orders: PlannedOrder[]
   skipped: SkippedAsset[]
   before: Map<string, Big>
   after: Map<string, Big>
   cashAfter: Big
   shortfall: Big
}

export class PlanError extends Error {
   constructor(message: string) {
      super(message)
      this.name = 'PlanError'
   }
}

const ZERO = Big(0)
const HUNDRED = Big(100)

export const floorTo = (amount: Big, step: Big): Big =>
   step.gt(0) ? amount.div(step).round(0, Big.roundDown).times(step) : amount

export const ceilTo = (amount: Big, step: Big): Big =>
   step.gt(0) ? amount.div(step).round(0, Big.roundUp).times(step) : amount

export function splitAmount(amount: Big, max: Big, step: Big): Big[] {
   if (max.lte(0) || amount.lte(max)) return [amount]
   const count = amount.div(max).round(0, Big.roundUp).toNumber()
   const chunk = floorTo(amount.div(count), step)
   return [...Array(count - 1).fill(chunk) as Big[], amount.minus(chunk.times(count - 1))]
}

const maxBuyAmount = (market: PlanMarket): Big => {
   const byQty = market.maxQty.gt(0) ? market.maxQty.times(market.ask) : ZERO
   if (market.maxAmount.lte(0)) return byQty
   return byQty.gt(0) && byQty.lt(market.maxAmount) ? byQty : market.maxAmount
}

export const sellFits = (market: PlanMarket, qty: Big): boolean =>
   qty.gt(0) && qty.gte(market.minQty) && qty.times(market.bid).gte(market.minAmount)

export const buyFits = (market: PlanMarket, amount: Big): boolean =>
   amount.gt(0) && amount.gte(market.minAmount) && amount.div(market.ask).gte(market.minQty)

export function sellOrders(market: PlanMarket, qty: Big): PlannedOrder[] {
   return splitAmount(floorTo(qty, market.baseStep), market.maxQty, market.baseStep)
      .filter(chunk => sellFits(market, chunk))
      .map(chunk => ({
         asset: market.base,
         symbol: market.symbol,
         side: 'sell' as const,
         unit: 'base' as const,
         amount: chunk,
         price: market.bid,
         value: chunk.times(market.bid)
      }))
}

export function buyOrders(market: PlanMarket, amount: Big): PlannedOrder[] {
   return splitAmount(floorTo(amount, market.quoteStep), maxBuyAmount(market), market.quoteStep)
      .filter(chunk => buyFits(market, chunk))
      .map(chunk => ({
         asset: market.base,
         symbol: market.symbol,
         side: 'buy' as const,
         unit: 'quote' as const,
         amount: chunk,
         price: market.ask,
         value: chunk
      }))
}

export function buyScale(budget: Big, planned: Big): Big {
   if (budget.lte(0)) return ZERO
   return budget.gte(planned) ? Big(1) : budget.div(planned)
}

const weightsOf = (values: Map<string, Big>): Map<string, Big> => {
   const total = [...values.values()].reduce((sum, value) => sum.plus(value), ZERO)
   return new Map([...values].map(([asset, value]) => [asset, total.gt(0) ? value.div(total).times(HUNDRED) : ZERO]))
}

interface Desired {
   asset: string
   value: Big
   all: boolean
}

export function planPortfolio(input: PlanInput): Plan {

   const { quote, holdings, targets, markets, free, band } = input
   const feeRate = input.feeRate ?? DEFAULT_FEE_RATE

   const assets = [...new Set([...holdings.keys(), ...targets.keys()])].filter(asset => asset !== quote)
   const cash = holdings.get(quote) ?? ZERO
   const skipped: SkippedAsset[] = []
   const values = new Map<string, Big>([[quote, cash]])

   for (const asset of assets) {
      const market = markets.get(asset)
      const quantity = holdings.get(asset) ?? ZERO
      if (!market || market.last.lte(0)) {
         if (!quantity.eq(0) || (targets.get(asset) ?? ZERO).gt(0)) {
            skipped.push({ asset, reason: market ? 'unpriced' : 'no-market', value: ZERO })
         }
         continue
      }
      values.set(asset, quantity.times(market.last))
   }

   const total = [...values.values()].reduce((sum, value) => sum.plus(value), ZERO)
   const withdraw = input.withdraw === 'all' ? total : input.withdraw

   if (withdraw.lt(0)) throw new PlanError('The amount to withdraw cannot be negative.')
   if (withdraw.gt(total)) {
      throw new PlanError(`Cannot withdraw more than the portfolio is worth (${total.toFixed()} ${quote}).`)
   }

   const investable = total.minus(withdraw)
   const targetValue = (asset: string) => (targets.get(asset) ?? ZERO).div(HUNDRED).times(investable)
   const reserve = targetValue(quote).plus(withdraw)
   const priced = assets.filter(asset => values.has(asset))

   const sells: Desired[] = []
   const buys: Desired[] = []

   if (withdraw.gt(0)) {
      if (cash.lt(withdraw)) {
         const over = priced
            .map(asset => ({ asset, value: values.get(asset)!.minus(targetValue(asset)) }))
            .filter(({ value }) => value.gt(0))
         const overTotal = over.reduce((sum, { value }) => sum.plus(value), ZERO)
         const needed = reserve.minus(cash)
         const share = overTotal.gt(0) ? needed.div(overTotal) : ZERO
         for (const { asset, value } of over) {
            const gross = value.times(share).div(Big(1).minus(feeRate))
            const worth = values.get(asset)!
            sells.push({ asset, value: gross.gt(worth) ? worth : gross, all: gross.gte(worth) })
         }
      }
   }
   else {
      const cashDrift = total.gt(0) ? cash.div(total).times(HUNDRED).minus(targets.get(quote) ?? ZERO) : ZERO

      for (const asset of priced) {
         const value = values.get(asset)!
         const target = targets.get(asset) ?? ZERO
         const quantity = holdings.get(asset) ?? ZERO

         if (target.eq(0)) {
            if (quantity.gt(0)) sells.push({ asset, value, all: true })
            continue
         }

         const drift = total.gt(0) ? value.div(total).times(HUNDRED).minus(target) : ZERO
         const delta = targetValue(asset).minus(value)
         const absorbsCash = (cashDrift.gt(band) && delta.gt(0)) || (cashDrift.lt(band.neg()) && delta.lt(0))
         if (drift.abs().lte(band) && !absorbsCash) {
            if (!drift.eq(0)) skipped.push({ asset, reason: 'within-band', value: delta.abs() })
            continue
         }

         if (delta.lt(0)) sells.push({ asset, value: delta.abs(), all: false })
         else if (delta.gt(0)) buys.push({ asset, value: delta, all: false })
      }
   }

   const orders: PlannedOrder[] = []

   for (const { asset, value, all } of sells) {
      const market = markets.get(asset)!
      const quantity = holdings.get(asset) ?? ZERO
      const available = free.get(asset) ?? ZERO
      const cap = quantity.lt(available) ? quantity : available

      if (cap.lte(0)) {
         skipped.push({ asset, reason: 'no-free-balance', value })
         continue
      }

      const sized = withdraw.gt(0) ? ceilTo(value.div(market.bid), market.baseStep) : value.div(market.bid)
      const wanted = all ? quantity : sized
      const planned = sellOrders(market, wanted.gt(cap) ? cap : wanted)

      if (planned.length === 0) skipped.push({ asset, reason: 'below-minimum', value })
      orders.push(...planned)
   }

   const proceeds = orders.reduce((sum, order) => sum.plus(order.value), ZERO).times(Big(1).minus(feeRate))
   const freeCash = free.get(quote) ?? ZERO
   const spendable = cash.lt(freeCash) ? cash : freeCash
   const budget = spendable.plus(proceeds).minus(reserve)
   const wantedBuys = buys.reduce((sum, { value }) => sum.plus(value), ZERO)
   const scale = buyScale(budget, wantedBuys)

   for (const { asset, value } of buys) {
      const planned = buyOrders(markets.get(asset)!, value.times(scale))
      if (planned.length === 0) {
         skipped.push({ asset, reason: budget.lte(0) ? 'no-cash' : 'below-minimum', value })
      }
      orders.push(...planned)
   }

   const after = new Map(values)
   let cashAfter = cash.minus(withdraw)

   for (const order of orders) {
      const market = markets.get(order.asset)!
      const current = after.get(order.asset) ?? ZERO
      if (order.side === 'sell') {
         after.set(order.asset, current.minus(order.amount.times(market.last)))
         cashAfter = cashAfter.plus(order.value.times(Big(1).minus(feeRate)))
      }
      else {
         const bought = order.amount.div(order.price).times(Big(1).minus(feeRate))
         after.set(order.asset, current.plus(bought.times(market.last)))
         cashAfter = cashAfter.minus(order.amount)
      }
   }

   after.set(quote, cashAfter)

   return {
      total,
      withdraw,
      reserve,
      orders: [...orders.filter(({ side }) => side === 'sell'), ...orders.filter(({ side }) => side === 'buy')],
      skipped,
      before: weightsOf(values),
      after: weightsOf(after),
      cashAfter,
      shortfall: cashAfter.lt(0) ? cashAfter.abs() : ZERO
   }
}
