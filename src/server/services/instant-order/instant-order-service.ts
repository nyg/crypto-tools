import Big from 'big.js'
import { HttpRequesterError, messageOf } from '../../errors'
import { makerPrice } from '../portfolio/limit-orders'
import { DEFAULT_FEE_RATE, planMarket } from '../portfolio/planner'
import { maxBuy, sizeInstantOrder } from './instant-order'
import InstantOrderTracker, { newClientOrderId, trackerOf } from './instant-order-tracker'
import type { PortfolioExchange } from '../portfolio/exchange'
import type { PlanMarket } from '../portfolio/planner'
import type { Venue } from '../portfolio/venues'
import type { RequestBody } from '../../routes/with-account'
import type {
   InstantOrderAccountResponse, InstantOrderActionResponse, InstantOrderBookResponse, InstantOrderMarketsResponse,
   InstantOrderPlaceResponse, InstantOrderState, InstantOrderStatusResponse, TrackedInstantOrder
} from '../../../types/api'
import type { OrderSide, SizeUnit, SpotMarket, TradeFees } from '../../../types/portfolio'

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
const MAX_STATUS_ORDERS = 20
const MAX_MOVE_PERCENT = 20

const isSide = (value: unknown): value is OrderSide => value === 'buy' || value === 'sell'
const isUnit = (value: unknown): value is SizeUnit => value === 'base' || value === 'quote'
const decimalPattern = /^\d+(\.\d+)?$/
const isPositive = (value: unknown): value is string =>
   typeof value === 'string' && decimalPattern.test(value) && Big(value).gt(0)

function movePercentOf(value: unknown): Big {
   if (!isPositive(value) || Big(value).gt(MAX_MOVE_PERCENT)) {
      throw new InstantOrderError(400, `How far the order may follow the price must be above 0 and at most ${MAX_MOVE_PERCENT} %.`)
   }
   return Big(value)
}

function trackedOf(value: unknown): TrackedInstantOrder {
   const { order, state } = (value ?? {}) as Partial<TrackedInstantOrder>
   if (typeof order?.id !== 'string' || typeof order.symbol !== 'string' || typeof state?.current?.clientOrderId !== 'string') {
      throw new InstantOrderError(400, 'No order was given.')
   }
   return { order, state }
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
      const market = await this.#planMarket(await this.#market(body.symbol))
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

      const { side, unit, amount, follow } = body
      if (!isSide(side)) throw new InstantOrderError(400, 'Buy or sell?')
      if (!isUnit(unit)) throw new InstantOrderError(400, 'The amount is neither in the base nor in the quote asset.')
      if (!isPositive(amount)) throw new InstantOrderError(400, 'The amount must be a positive number.')
      const maxMove = follow === true ? movePercentOf(body.maxMovePercent) : null

      const market = await this.#market(body.symbol)

      for (let refusals = 0; refusals < MAX_REFUSALS; refusals++) {

         const sizing = sizeInstantOrder(side, unit, Big(amount), await this.#planMarket(market))
         if ('refusal' in sizing) throw new InstantOrderError(409, sizing.refusal)

         const clientOrderId = newClientOrderId()
         const order = {
            id: clientOrderId, symbol: market.symbol, base: market.base, quote: market.quote, side,
            quantity: sizing.quantity.toFixed(), placedAt: Date.now()
         }

         let orderId: string | null = null
         try {
            orderId = await this.#exchange.placeLimitOrder({
               clientOrderId, symbol: market.symbol, side, quantity: order.quantity, price: sizing.price.toFixed()
            }) || null
         }
         catch (error) {
            if (!(error instanceof HttpRequesterError)) throw error
            if (this.#exchange.isPostOnlyRefusal(error)) continue
            if (this.#isRejection(error)) throw new InstantOrderError(409, this.#exchange.describeError(error))
            console.warn('Could not tell whether order', clientOrderId, 'was placed:', this.#describe(error))
         }

         const lookup = { symbol: market.symbol, clientOrderId, orderId }
         const tracker = InstantOrderTracker.placed(this.#venue, this.#exchange, market, order, { lookup, price: sizing.price })
         return { order, state: maxMove ? tracker.follow(true, maxMove) : tracker.state }
      }

      throw new InstantOrderError(409, `The ${this.#venue.label} book kept moving onto the price: try again.`)
   }

   async status(body: RequestBody): Promise<InstantOrderStatusResponse> {
      const tracked = (Array.isArray(body.orders) ? body.orders : []).slice(0, MAX_STATUS_ORDERS).map(trackedOf)
      const states: Record<string, InstantOrderState> = {}
      for (const entry of tracked) {
         const tracker = await this.#tracker(entry)
         states[entry.order.id] = tracker.following ? tracker.state : await tracker.refresh()
      }
      return { fetchedAt: Date.now(), states }
   }

   async cancel(body: RequestBody): Promise<InstantOrderActionResponse> {
      return { state: await (await this.#tracker(trackedOf(body))).cancel() }
   }

   async reprice(body: RequestBody): Promise<InstantOrderActionResponse> {
      return { state: await (await this.#tracker(trackedOf(body))).reprice() }
   }

   async follow(body: RequestBody): Promise<InstantOrderActionResponse> {
      const tracker = await this.#tracker(trackedOf(body))
      const on = body.follow === true
      return { state: tracker.follow(on, on ? movePercentOf(body.maxMovePercent) : Big(0)) }
   }

   async #tracker(entry: TrackedInstantOrder): Promise<InstantOrderTracker> {
      return trackerOf(entry.order.id)
         ?? InstantOrderTracker.restored(this.#venue, this.#exchange, await this.#market(entry.order.symbol), entry)
   }

   async #market(symbol: unknown): Promise<SpotMarket> {
      const market = (await this.#exchange.markets()).find(entry => entry.symbol === symbol)
      if (!market) throw new InstantOrderError(400, `${this.#venue.label} lists no ${String(symbol)} market.`)
      return market
   }

   async #planMarket(market: SpotMarket): Promise<PlanMarket> {
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
