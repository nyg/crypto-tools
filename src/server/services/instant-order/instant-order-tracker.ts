import Big from 'big.js'
import { randomUUID } from 'crypto'
import { HttpRequesterError, messageOf } from '../../errors'
import { leftBehind, priceBound, restingPrice } from '../portfolio/limit-orders'
import { planMarket } from '../portfolio/planner'
import { addFill, closedStatus, fillOf, noFill, sizeRest, summaryOf, wireFill } from './instant-order'
import type { Fill } from './instant-order'
import type { PortfolioExchange } from '../portfolio/exchange'
import type { PlanMarket } from '../portfolio/planner'
import type { StreamSubscription } from '../../adapters/websocket/socket-hub'
import type { Venue } from '../portfolio/venues'
import type { InstantOrder, InstantOrderState, InstantOrderStatus, TrackedInstantOrder } from '../../../types/api'
import type { OrderEvent, OrderLookup, OrderSettlement, SpotMarket, SpotPrice } from '../../../types/portfolio'

const MAX_REFUSALS = 3
const MAX_MISSES = 5
const CLOSE_CHECKS = 4
const CLOSE_CHECK_MS = 500
const KEPT_FOR_MS = 60 * 60 * 1000
const WOULD_TAKE = 'At that price it would have taken liquidity.'
const NEVER_REACHED = 'The order never reached the exchange.'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// At most 18 characters, which is all Kraken's cl_ord_id takes.
export const newClientOrderId = () => `io${Date.now().toString(36)}${randomUUID().slice(0, 6)}`

const turns = new Map<string, Promise<unknown>>()
const trackers = new Map<string, InstantOrderTracker>()

export const trackerOf = (id: string) => trackers.get(id)

function register(tracker: InstantOrderTracker): InstantOrderTracker {
   const now = Date.now()
   for (const [id, kept] of trackers) if (kept.finishedAt !== null && now - kept.finishedAt > KEPT_FOR_MS) trackers.delete(id)
   trackers.set(tracker.order.id, tracker)
   return tracker
}

// Kraken counts every order check against one counter for the whole account, so the
// orders it follows side by side are checked in turn rather than each at this pace.
// Only while its order stream is down: with the stream up, an order is checked when
// the exchange says it closed.
function turnOf(venue: Venue, exchange: PortfolioExchange): Promise<unknown> {
   const { pollMs, pollsTakeTurns } = exchange.chasePacing
   if (!pollsTakeTurns) return delay(pollMs)
   const turn = (turns.get(venue.id) ?? Promise.resolve()).then(() => delay(pollMs))
   turns.set(venue.id, turn)
   return turn
}

type Phase = 'live' | 'between' | 'done'

interface Attempt {
   lookup: OrderLookup
   price: Big
}

export default class InstantOrderTracker {

   readonly order: InstantOrder
   finishedAt: number | null = null

   readonly #venue: Venue
   readonly #exchange: PortfolioExchange
   readonly #market: SpotMarket
   #attempt: Attempt
   #phase: Phase
   #confirmed: boolean
   #closed: Fill
   #live: OrderSettlement | null = null
   #status: InstantOrderStatus
   #following = false
   #bound: Big | null = null
   #moves: number
   #reason: string
   #misses = 0
   #movableAt = 0
   #lock: Promise<unknown> = Promise.resolve()
   #bookStream: StreamSubscription | null = null
   #orderStream: StreamSubscription | null = null
   #streamedBook: SpotPrice | null = null
   #placing: string | null = null
   #placingClosed = false
   #woken = false
   #checkDue = false
   #wake: (() => void) | null = null
   #timer: ReturnType<typeof setTimeout> | null = null
   #timerAt = 0
   #turnPending = false
   #running = false

   private constructor(venue: Venue, exchange: PortfolioExchange, market: SpotMarket, order: InstantOrder, state: InstantOrderState) {
      this.#venue = venue
      this.#exchange = exchange
      this.#market = market
      this.order = order
      this.#attempt = { lookup: state.current, price: Big(state.price) }
      this.#closed = fillOf(state.closed)
      this.#status = state.status
      this.#moves = state.moves
      this.#reason = state.reason
      this.#confirmed = state.current.orderId !== null
      this.#phase = ['filled', 'partial', 'cancelled'].includes(state.status) ? 'done' : 'live'
      if (this.#phase === 'done') this.finishedAt = Date.now()
   }

   static placed(venue: Venue, exchange: PortfolioExchange, market: SpotMarket, order: InstantOrder, attempt: Attempt): InstantOrderTracker {
      const tracker = new InstantOrderTracker(venue, exchange, market, order, {
         current: attempt.lookup, price: attempt.price.toFixed(), status: attempt.lookup.orderId ? 'open' : 'unknown',
         following: false, bound: null, moves: 0, closed: wireFill(noFill()),
         filled: '0', averagePrice: '0', fees: [], reason: ''
      })
      tracker.#movableAt = Date.now() + exchange.chasePacing.moveAfterMs
      return register(tracker)
   }

   static restored(venue: Venue, exchange: PortfolioExchange, market: SpotMarket, { order, state }: TrackedInstantOrder): InstantOrderTracker {
      return register(new InstantOrderTracker(venue, exchange, market, order, state))
   }

   get following(): boolean {
      return this.#following
   }

   get state(): InstantOrderState {
      const total = this.#live && this.#phase === 'live' ? addFill(this.#closed, this.#live) : this.#closed
      return {
         current: this.#attempt.lookup,
         price: this.#attempt.price.toFixed(),
         status: this.#status,
         following: this.#following,
         bound: this.#bound?.toFixed() ?? null,
         moves: this.#moves,
         closed: wireFill(this.#closed),
         ...summaryOf(total),
         reason: this.#reason
      }
   }

   refresh(): Promise<InstantOrderState> {
      return this.#serial(async () => {
         if (this.#phase === 'live') await this.#check()
         return this.state
      })
   }

   reprice(): Promise<InstantOrderState> {
      return this.#serial(async () => {
         if (this.#phase === 'live') await this.#check()
         if (this.#phase === 'live' && this.#status === 'open') await this.#move(true)
         else if (this.#phase === 'between') await this.#placeRest()
         return this.state
      })
   }

   cancel(): Promise<InstantOrderState> {
      this.#following = false
      this.#poke(false)
      return this.#serial(async () => {
         if (this.#phase === 'between') this.#finish('')
         if (this.#phase !== 'live') return this.state

         try {
            await this.#exchange.cancelOrder(this.#attempt.lookup)
         }
         catch (error) {
            this.#reason = this.#describe(error)
            return this.state
         }
         await this.#awaitClose(false)
         return this.state
      })
   }

   follow(on: boolean, maxMovePercent: Big): InstantOrderState {
      if (!on || this.#phase === 'done') {
         this.#following = false
         this.#poke(false)
         return this.state
      }
      this.#bound = priceBound(this.order.side, this.#attempt.price, maxMovePercent, Big(this.#market.tickStep || 0))
      this.#following = true
      if (!this.#running) void this.#run()
      return this.state
   }

   async #run(): Promise<void> {
      this.#running = true
      this.#watch()
      try {
         while (this.#following && this.#phase !== 'done') {
            const check = await this.#nextTurn()
            await this.#serial(async () => {
               if (!this.#following || this.#phase === 'done') return
               if (this.#phase === 'live' && check) await this.#check()
               if (this.#phase === 'between') await this.#placeRest()
               else if (this.#phase === 'live' && this.#status === 'open') await this.#move(false)
            }).catch(error => console.warn('Could not follow order', this.order.id, this.#describe(error)))
         }
      }
      finally {
         this.#unwatch()
         this.#running = false
      }
   }

   #watch(): void {
      this.#bookStream = this.#exchange.watchBook?.(this.#market, {
         onEvent: book => {
            this.#streamedBook = book
            this.#poke(false)
         },
         onLive: live => {
            if (!live) this.#streamedBook = null
            this.#poke(false)
         }
      }) ?? null
      this.#orderStream = this.#exchange.watchOrders?.({
         onEvent: event => this.#heard(event),
         onLive: () => this.#poke(true)
      }) ?? null
   }

   #unwatch(): void {
      this.#bookStream?.close()
      this.#orderStream?.close()
      this.#bookStream = this.#orderStream = this.#streamedBook = null
      if (this.#timer) clearTimeout(this.#timer)
      this.#timer = null
   }

   #heard(event: OrderEvent): void {
      const { clientOrderId, orderId } = this.#attempt.lookup
      if (event.clientOrderId && event.clientOrderId === this.#placing) this.#placingClosed ||= event.closed
      if (event.clientOrderId !== clientOrderId && (!orderId || event.orderId !== orderId)) return
      if (event.closed) return this.#poke(true)
      if (this.#phase !== 'live' || event.base === null || event.quote === null) return
      const known = this.#live ?? { averagePrice: '0', fees: {}, reason: '' }
      this.#live = { ...known, orderId: event.orderId, status: 'open', base: event.base, quote: event.quote }
   }

   async #nextTurn(): Promise<boolean> {
      const { pollMs } = this.#exchange.chasePacing
      if (!this.#orderStream?.live || !this.#confirmed) this.#awaitTurn()
      else if (!this.#bookStream?.live || this.#phase === 'between') this.#arm(Date.now() + pollMs)
      if (this.#movableAt > Date.now()) this.#arm(this.#movableAt)

      if (!this.#woken) await new Promise<void>(resolve => { this.#wake = resolve })
      const check = this.#checkDue
      this.#woken = this.#checkDue = false
      return check
   }

   #awaitTurn(): void {
      if (this.#turnPending) return
      this.#turnPending = true
      void turnOf(this.#venue, this.#exchange).then(() => {
         this.#turnPending = false
         this.#poke(true)
      })
   }

   #arm(at: number): void {
      if (this.#timer && this.#timerAt <= at) return
      if (this.#timer) clearTimeout(this.#timer)
      this.#timerAt = at
      this.#timer = setTimeout(() => {
         this.#timer = null
         this.#poke(false)
      }, Math.max(0, at - Date.now()))
   }

   #poke(check: boolean): void {
      this.#checkDue ||= check
      this.#woken = true
      const wake = this.#wake
      this.#wake = null
      wake?.()
   }

   #serial<T>(work: () => Promise<T>): Promise<T> {
      const run = this.#lock.then(work)
      this.#lock = run.catch(() => {})
      return run
   }

   async #check(moving = false): Promise<void> {
      let settlement: OrderSettlement | null
      try {
         settlement = await this.#exchange.settleOrder(this.#attempt.lookup)
      }
      catch (error) {
         this.#reason = this.#describe(error)
         return
      }

      if (!settlement) {
         if (!this.#confirmed && ++this.#misses >= MAX_MISSES) this.#finish(NEVER_REACHED)
         return
      }

      this.#confirmed = true
      this.#misses = 0
      this.#attempt.lookup = { ...this.#attempt.lookup, orderId: this.#attempt.lookup.orderId ?? settlement.orderId }

      if (settlement.status === 'open') {
         this.#live = settlement
         this.#status = 'open'
         return
      }

      this.#closed = addFill(this.#closed, settlement)
      this.#live = null

      if (this.#remaining().lte(0)) return this.#finish('')
      if (moving || (settlement.postOnlyRefused && this.#following)) {
         this.#phase = 'between'
         this.#reason = moving ? '' : WOULD_TAKE
         return
      }
      this.#finish(settlement.postOnlyRefused ? WOULD_TAKE : settlement.reason)
   }

   async #move(force: boolean): Promise<void> {
      if (!force && Date.now() < this.#movableAt) return

      const market = await this.#planMarket()
      const desired = this.#desired(market)
      if (!desired || desired.eq(this.#attempt.price)) return
      if (!force && !leftBehind(this.order.side, this.#attempt.price, desired)) return

      if (this.#exchange.amendLimitPrice) return this.#amend(desired)

      try {
         await this.#exchange.cancelOrder(this.#attempt.lookup)
      }
      catch (error) {
         this.#reason = this.#describe(error)
         return
      }
      await this.#awaitClose(true)
      if (this.#phase === 'between') await this.#placeRest()
      else if (this.#phase === 'live') this.#reason = `${this.#venue.label} had not closed the order yet.`
   }

   async #awaitClose(moving: boolean): Promise<void> {
      for (let check = 0; check < CLOSE_CHECKS && this.#phase === 'live'; check++) {
         if (check > 0) await delay(CLOSE_CHECK_MS)
         await this.#check(moving)
      }
   }

   async #amend(price: Big): Promise<void> {
      try {
         await this.#exchange.amendLimitPrice!(this.#attempt.lookup, price.toFixed())
         this.#attempt.price = price
         this.#moves++
         this.#reason = ''
         this.#movableAt = Date.now() + this.#exchange.chasePacing.moveAfterMs
      }
      catch (error) {
         this.#reason = error instanceof HttpRequesterError && this.#exchange.isPostOnlyRefusal(error) ? WOULD_TAKE : this.#describe(error)
      }
   }

   async #placeRest(): Promise<void> {
      for (let refusals = 0; refusals < MAX_REFUSALS; refusals++) {
         const market = await this.#planMarket()
         const desired = this.#desired(market)
         if (!desired) return

         const sizing = sizeRest(this.#remaining(), desired, market)
         if ('refusal' in sizing) return this.#finish(`What is left is too small to place again. ${sizing.refusal}`)

         const lookup = { symbol: market.symbol, clientOrderId: newClientOrderId(), orderId: null }
         this.#placing = lookup.clientOrderId
         this.#placingClosed = false
         try {
            const orderId = await this.#exchange.placeLimitOrder({
               clientOrderId: lookup.clientOrderId, symbol: market.symbol, side: this.order.side,
               quantity: sizing.quantity.toFixed(), price: sizing.price.toFixed(), feeAsset: this.order.feeAsset
            })
            this.#started({ ...lookup, orderId: orderId || null }, sizing.price, Boolean(orderId))
            return
         }
         catch (error) {
            if (!(error instanceof HttpRequesterError)) throw error
            if (this.#exchange.isPostOnlyRefusal(error)) continue
            if (error.statusCode < 500 && !this.#exchange.isAmbiguous(error)) return this.#finish(this.#exchange.describeError(error))
            this.#started(lookup, sizing.price, false)
            return
         }
      }
      this.#reason = WOULD_TAKE
   }

   #started(lookup: OrderLookup, price: Big, confirmed: boolean): void {
      if (this.#placingClosed) this.#poke(true)
      this.#placing = null
      this.#attempt = { lookup, price }
      this.#phase = 'live'
      this.#status = confirmed ? 'open' : 'unknown'
      this.#confirmed = confirmed
      this.#misses = 0
      this.#moves++
      this.#reason = ''
      this.#movableAt = Date.now() + this.#exchange.chasePacing.moveAfterMs
   }

   #finish(reason: string): void {
      this.#phase = 'done'
      this.#following = false
      this.#live = null
      this.#status = closedStatus(Big(this.order.quantity), this.#closed.base)
      this.#reason = this.#status === 'filled' ? '' : reason
      this.finishedAt = Date.now()
      this.#poke(false)
   }

   #remaining(): Big {
      return Big(this.order.quantity).minus(this.#closed.base)
   }

   #desired(market: PlanMarket): Big | null {
      const tick = market.tickStep
      const bound = this.#bound ?? (this.order.side === 'buy' ? market.ask : market.bid)
      return restingPrice(this.order.side, market, tick, bound)
   }

   async #planMarket(): Promise<PlanMarket> {
      const streamed = this.#bookStream?.live ? this.#streamedBook : null
      return planMarket(this.#market, streamed ?? (await this.#exchange.prices())[this.#market.symbol])
   }

   #describe(error: unknown): string {
      return error instanceof HttpRequesterError ? this.#exchange.describeError(error) : messageOf(error)
   }
}
