import Big from 'big.js'
import type { OrderSide } from '../../../types/portfolio'

export interface HoldingMovement {
   asset: string
   amount: string
}

export interface HoldingOrder {
   side: OrderSide
   baseAsset: string
   quoteAsset: string
   base: string
   quote: string
}

export function orderDeltas({ side, baseAsset, quoteAsset, base, quote }: HoldingOrder): HoldingMovement[] {
   const sign = side === 'buy' ? 1 : -1
   return [
      { asset: baseAsset, amount: Big(base || 0).times(sign).toFixed() },
      { asset: quoteAsset, amount: Big(quote || 0).times(-sign).toFixed() }
   ]
}

export function foldHoldings(movements: HoldingMovement[], orders: HoldingOrder[] = []): Map<string, Big> {

   const holdings = new Map<string, Big>()

   for (const { asset, amount } of [...movements, ...orders.flatMap(orderDeltas)]) {
      holdings.set(asset, (holdings.get(asset) ?? Big(0)).plus(amount || 0))
   }

   for (const [asset, amount] of holdings) {
      if (amount.eq(0)) holdings.delete(asset)
   }

   return holdings
}

export function sameHoldings(left: Map<string, Big>, right: Map<string, Big>): boolean {
   if (left.size !== right.size) return false
   for (const [asset, amount] of left) {
      if (!right.get(asset)?.eq(amount)) return false
   }
   return true
}
