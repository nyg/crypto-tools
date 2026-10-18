import Big from 'big.js'
import { randomUUID } from 'crypto'
import { HttpRequesterError, messageOf } from '../../errors'
import { makerPrice } from '../portfolio/limit-orders'
import { DEFAULT_FEE_RATE, planMarket } from '../portfolio/planner'
import { maxBuy, sizeInstantOrder, stateOf } from './instant-order'
import type { PortfolioExchange } from '../portfolio/exchange'
import type { PlanMarket } from '../portfolio/planner'
import type { Venue } from '../portfolio/venues'
import type { RequestBody } from '../../routes/with-account'
import type {
   InstantOrderAccountResponse, InstantOrderBookResponse, InstantOrderCancelResponse, InstantOrderMarketsResponse,
   InstantOrderPlaceResponse, InstantOrderState, InstantOrderStatusResponse
} from '../../../types/api'
import type { OrderLookup, OrderSide, SizeUnit, SpotMarket, TradeFees } from '../../../types/portfolio'

export type InstantOrderErrorStatus = 400 | 409 | 502

export class InstantOrderError extends Error {
   readonly status: InstantOrderErrorStatus

   constructor(status: InstantOrderErrorStatus, message: string) {
      super(message)
      this.name = 'InstantOrderError'
      this.status = status
   }
}

const MAX_REFUSALS = 3
const CLOSE_CHECKS = 4
const CLOSE_CHECK_MS = 500
const MAX_STATUS_ORDERS = 20

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// At most 18 characters, which is all Kraken's cl_ord_id takes.
const newClientOrderId = () => `io${Date.now().toString(36)}${randomUUID().slice(0, 6)}`

const isSide = (value: unknown): value is OrderSide => value === 'buy' || value === 'sell'
const isUnit = (value: unknown): value is SizeUnit => value === 'base' || value === 'quote'
const decimalPattern = /^\d+(\.\d+)?$/

function lookupOf(value: unknown): OrderLookup {
   const { symbol, clientOrderId, orderId } = (value ?? {}) as Partial<OrderLookup>
   if (typeof symbol !== 'string' || typeof clientOrderId !== 'string') throw new InstantOrderError(400, 'No order was given.')
   return { symbol, clientOrderId, orderId: typeof orderId === 'string' && orderId ? orderId : null }
}

export default class InstantOrderService {

   readonly #venue: Venue
   readonly #exchange: PortfolioExchange

   constructor(venue: Venue, exchange: PortfolioExchange) {
      this.#venue = venue
      this.#exchange = exchange
   }

   async markets(): Promise<InstantOrderMarketsResponse> {
      const markets = await this.#exchange.markets()
      return {
         markets: markets
            .map(({ symbol, base, quote, tickStep }) => ({ symbol, base, quote, tickStep }))
            .sort((left, right) => left.base.localeCompare(right.base) || left.quote.localeCompare(right.quote))
      }
   }

   async book(body: RequestBody): Promise<InstantOrderBookResponse> {
      const market = await this.#planMarket(body.symbol)
      return {
         fetchedAt: Date.now(),
         bid: market.bid.toFixed(),
         ask: market.ask.toFixed(),
         buyPrice: makerPrice('buy', market, market.tickStep)?.toFixed() ?? null,
         sellPrice: makerPrice('sell', market, market.tickStep)?.toFixed() ?? null
      }
   }

   async account(body: RequestBody): Promise<InstantOrderAccountResponse> {

      const market = await this.#market(body.symbol)
      const [wallet, fees] = await Promise.all([this.#exchange.wallet(), this.#tradeFees(market.symbol)])
      const freeOf = (asset: string) => Big(wallet.find(coin => coin.asset === asset)?.free || 0)
      const freeQuote = freeOf(market.quote)
      const makerBuy = Big(fees?.maker.buy ?? DEFAULT_FEE_RATE)

      return {
         fetchedAt: Date.now(),
         base: market.base,
         quote: market.quote,
         freeBase: freeOf(market.base).toFixed(),
         freeQuote: freeQuote.toFixed(),
         maxBuy: maxBuy(freeQuote, makerBuy, this.#exchange.buyFeeInQuote, Big(market.quoteStep || 0)).toFixed(),
         baseStep: market.baseStep,
         minQty: market.minQty,
         minAmount: market.minAmount,
         fees: fees && {
            buy: { maker: fees.maker.buy, taker: fees.taker.buy },
            sell: { maker: fees.maker.sell, taker: fees.taker.sell }
         }
      }
   }

   async place(body: RequestBody): Promise<InstantOrderPlaceResponse> {

      const { side, unit, amount } = body
      if (!isSide(side)) throw new InstantOrderError(400, 'Buy or sell?')
      if (!isUnit(unit)) throw new InstantOrderError(400, 'The amount is neither in the base nor in the quote asset.')
      if (typeof amount !== 'string' || !decimalPattern.test(amount) || Big(amount).lte(0)) {
         throw new InstantOrderError(400, 'The amount must be a positive number.')
      }

      for (let refusals = 0; refusals < MAX_REFUSALS; refusals++) {

         const market = await this.#planMarket(body.symbol)
         const sizing = sizeInstantOrder(side, unit, Big(amount), market)
         if ('refusal' in sizing) throw new InstantOrderError(409, sizing.refusal)

         const order = {
            clientOrderId: newClientOrderId(),
            symbol: market.symbol,
            side,
            quantity: sizing.quantity.toFixed(),
            price: sizing.price.toFixed()
         }
         const placed = { ...order, base: market.base, quote: market.quote, orderId: null, placedAt: Date.now() }

         try {
            return { order: { ...placed, orderId: await this.#exchange.placeLimitOrder(order) || null } }
         }
         catch (error) {
            if (!(error instanceof HttpRequesterError)) throw error
            if (this.#exchange.isPostOnlyRefusal(error)) continue
            if (this.#isRejection(error)) throw new InstantOrderError(409, this.#exchange.describeError(error))
            console.warn('Could not tell whether order', order.clientOrderId, 'was placed:', this.#describe(error))
            return { order: placed }
         }
      }

      throw new InstantOrderError(409, `The ${this.#venue.label} book kept moving onto the price: try again.`)
   }

   async status(body: RequestBody): Promise<InstantOrderStatusResponse> {

      const lookups = (Array.isArray(body.orders) ? body.orders : []).slice(0, MAX_STATUS_ORDERS).map(lookupOf)
      const states: Record<string, InstantOrderState> = {}
      for (const lookup of lookups) states[lookup.clientOrderId] = await this.#state(lookup)

      return { fetchedAt: Date.now(), states }
   }

   async cancel(body: RequestBody): Promise<InstantOrderCancelResponse> {

      const lookup = lookupOf(body.order)
      try {
         await this.#exchange.cancelOrder(lookup)
      }
      catch (error) {
         if (error instanceof HttpRequesterError) throw new InstantOrderError(502, this.#exchange.describeError(error))
         throw error
      }

      let state = await this.#state(lookup)
      for (let check = 1; check < CLOSE_CHECKS && state.status === 'open'; check++) {
         await delay(CLOSE_CHECK_MS)
         state = await this.#state(lookup)
      }
      return { state }
   }

   async #state(lookup: OrderLookup): Promise<InstantOrderState> {
      try {
         return stateOf(await this.#exchange.settleOrder(lookup))
      }
      catch (error) {
         return stateOf(null, this.#describe(error))
      }
   }

   async #market(symbol: unknown): Promise<SpotMarket> {
      const market = (await this.#exchange.markets()).find(entry => entry.symbol === symbol)
      if (!market) throw new InstantOrderError(400, `${this.#venue.label} lists no ${String(symbol)} market.`)
      return market
   }

   async #planMarket(symbol: unknown): Promise<PlanMarket> {
      const market = await this.#market(symbol)
      return planMarket(market, (await this.#exchange.prices())[market.symbol])
   }

   async #tradeFees(symbol: string): Promise<TradeFees | null> {
      if (!this.#exchange.tradeFees) return null
      try {
         return (await this.#exchange.tradeFees([symbol]))[symbol] ?? null
      }
      catch (error) {
         console.warn('Could not read the', symbol, 'fees:', this.#describe(error))
         return null
      }
   }

   #describe(error: unknown): string {
      return error instanceof HttpRequesterError ? this.#exchange.describeError(error) : messageOf(error)
   }

   #isRejection(error: HttpRequesterError): boolean {
      return error.statusCode < 500 && !this.#exchange.isAmbiguous(error)
   }
}
