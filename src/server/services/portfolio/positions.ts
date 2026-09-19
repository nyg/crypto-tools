import Big from 'big.js'
import type { MovementKind, OrderSide } from '../../../types/portfolio'

export interface PositionMovement {
   kind: MovementKind
   asset: string
   amount: string
   value: string
   orderLinkId: string | null
   createdAt: number
}

export interface PositionOrder {
   orderLinkId: string
   side: OrderSide
   baseAsset: string
   base: string
   quote: string
   createdAt: number
}

export interface Position {
   quantity: Big
   cost: Big
   realized: Big
}

export interface Positions {
   coins: Map<string, Position>
   cashRealized: Big
}

type Event =
   | { createdAt: number, movement: PositionMovement }
   | { createdAt: number, order: PositionOrder }

const ZERO = Big(0)
const ONE = Big(1)

export function foldPositions(quote: string, movements: PositionMovement[], orders: PositionOrder[]): Positions {

   const coins = new Map<string, Position>()
   let cashRealized = ZERO

   const positionOf = (asset: string): Position => {
      const existing = coins.get(asset)
      if (existing) return existing
      const created = { quantity: ZERO, cost: ZERO, realized: ZERO }
      coins.set(asset, created)
      return created
   }

   const acquire = (asset: string, quantity: Big, cost: Big) => {
      const position = positionOf(asset)
      position.quantity = position.quantity.plus(quantity)
      position.cost = position.cost.plus(cost)
   }

   const dispose = (asset: string, quantity: Big, proceeds: Big) => {
      const position = positionOf(asset)
      const share = position.quantity.gt(quantity) ? quantity.div(position.quantity) : ONE
      const released = position.cost.times(share)
      position.quantity = position.quantity.minus(quantity)
      position.cost = position.cost.minus(released)
      position.realized = position.realized.plus(proceeds.minus(released))
   }

   const ordersByLink = new Map(orders.map(order => [order.orderLinkId, order]))
   const feesByLink = new Map<string, PositionMovement[]>()
   const standalone: PositionMovement[] = []

   for (const movement of movements) {
      const linked = movement.kind === 'fee' && movement.orderLinkId !== null && ordersByLink.has(movement.orderLinkId)
      if (linked) feesByLink.set(movement.orderLinkId!, [...feesByLink.get(movement.orderLinkId!) ?? [], movement])
      else standalone.push(movement)
   }

   const payFee = (fee: PositionMovement, order: PositionOrder | null) => {
      const amount = Big(fee.amount).abs()
      if (fee.asset !== quote) {
         const position = positionOf(fee.asset)
         position.quantity = position.quantity.minus(amount)
      }
      else if (order) {
         const position = positionOf(order.baseAsset)
         position.realized = position.realized.minus(amount)
      }
      else cashRealized = cashRealized.minus(amount)
   }

   const applyMovement = (movement: PositionMovement) => {
      const amount = Big(movement.amount)
      if (movement.kind === 'fee') return payFee(movement, null)
      if (movement.asset === quote) {
         if (movement.kind === 'adjust') cashRealized = cashRealized.plus(amount)
         return
      }
      if (movement.kind === 'deposit') acquire(movement.asset, amount, Big(movement.value))
      else if (movement.kind === 'withdraw') dispose(movement.asset, amount.abs(), Big(movement.value).abs())
      else if (amount.gt(0)) acquire(movement.asset, amount, ZERO)
      else dispose(movement.asset, amount.abs(), ZERO)
   }

   const applyOrder = (order: PositionOrder) => {
      const base = Big(order.base || 0)
      if (base.gt(0)) {
         if (order.side === 'buy') acquire(order.baseAsset, base, Big(order.quote || 0))
         else dispose(order.baseAsset, base, Big(order.quote || 0))
      }
      for (const fee of feesByLink.get(order.orderLinkId) ?? []) payFee(fee, order)
   }

   const events: Event[] = [
      ...standalone.map(movement => ({ createdAt: movement.createdAt, movement })),
      ...orders.map(order => ({ createdAt: order.createdAt, order }))
   ]

   for (const event of events.toSorted((left, right) => left.createdAt - right.createdAt)) {
      if ('movement' in event) applyMovement(event.movement)
      else applyOrder(event.order)
   }

   return { coins, cashRealized }
}
