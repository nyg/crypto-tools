import { describe, expect, test } from 'bun:test'
import Big from 'big.js'
import { HttpRequesterError } from '../../errors'
import InstantOrderService, { InstantOrderError } from './instant-order-service'
import type { PortfolioExchange } from '../portfolio/exchange'
import type { Venue } from '../portfolio/venues'
import type { InstantOrderState, TrackedInstantOrder } from '../../../types/api'
import type {
   ExchangeAccount, LimitOrderRequest, OpenStopOrder, OrderLookup, OrderSettlement, SpotCandle, SpotMarket,
   SpotPrice, TradeFees, WalletCoin
} from '../../../types/portfolio'

const POST_ONLY_REFUSED = 'post-only'

interface FakeOrder {
   request: LimitOrderRequest
   orderId: string
   filled: Big
   closed: boolean
   postOnlyRefused?: boolean
}

class FakeExchange implements PortfolioExchange {

   readonly balanceDecimals = 8
   readonly buyFeeInQuote = true
   readonly choosesFeeAsset: boolean
   readonly chasePacing = { pollMs: 2, moveAfterMs: 0, pollsTakeTurns: false }
   readonly orders = new Map<string, FakeOrder>()
   readonly amended: string[] = []
   amendLimitPrice?: (order: OrderLookup, price: string) => Promise<void>
   books: SpotPrice[] = [{ last: '100', bid: '100', ask: '100.5' }]
   refusals = 0
   failure: HttpRequesterError | null = null
   closesAfterChecks = 0

   constructor({ amends = false, choosesFeeAsset = true } = {}) {
      this.choosesFeeAsset = choosesFeeAsset
      if (amends) {
         this.amendLimitPrice = async ({ clientOrderId }, price) => {
            this.amended.push(price)
            this.orders.get(clientOrderId)!.request.price = price
         }
      }
   }

   set book(book: SpotPrice) {
      this.books = [book]
   }

   fill(clientOrderId: string, base: string): void {
      const order = this.orders.get(clientOrderId)!
      order.filled = order.filled.plus(base)
      order.closed = order.filled.gte(order.request.quantity)
   }

   placedOrders(): LimitOrderRequest[] {
      return [...this.orders.values()].map(({ request }) => request)
   }

   async account(): Promise<ExchangeAccount> {
      return { accountId: 'fake', canTrade: true, expiresAt: null }
   }

   async wallet(): Promise<WalletCoin[]> {
      return [
         { asset: 'SOL', total: '3', free: '2', borrowed: '0' },
         { asset: 'USD', total: '1002', free: '1002', borrowed: '0' }
      ]
   }

   async markets(): Promise<SpotMarket[]> {
      return [{
         symbol: 'SOLUSD', base: 'SOL', quote: 'USD', baseStep: '0.01', quoteStep: '0.01', tickStep: '0.01',
         minQty: '0.01', minAmount: '5', maxQty: '1000', maxAmount: '0'
      }]
   }

   async prices(): Promise<Record<string, SpotPrice>> {
      const book = this.books.length > 1 ? this.books.shift()! : this.books[0]!
      return { SOLUSD: book }
   }

   async candles(): Promise<SpotCandle[]> {
      return []
   }

   async tradeFees(): Promise<Record<string, TradeFees>> {
      return { SOLUSD: { maker: { buy: '0.002', sell: '0.002' }, taker: { buy: '0.004', sell: '0.004' } } }
   }

   async placeOrder(): Promise<string> {
      throw new Error('An instant order is never a market order.')
   }

   async placeLimitOrder(request: LimitOrderRequest): Promise<string> {
      if (this.failure) throw this.failure
      if (this.refusals > 0) {
         this.refusals--
         throw new HttpRequesterError(400, POST_ONLY_REFUSED)
      }
      const orderId = `O${this.orders.size + 1}`
      this.orders.set(request.clientOrderId, { request: { ...request }, orderId, filled: Big(0), closed: false })
      return orderId
   }

   async cancelOrder({ clientOrderId }: OrderLookup): Promise<void> {
      const order = this.orders.get(clientOrderId)
      if (order) order.closed = true
   }

   async settleOrder({ clientOrderId }: OrderLookup): Promise<OrderSettlement | null> {
      const order = this.orders.get(clientOrderId)
      if (!order) return null
      const closed = order.closed && this.closesAfterChecks-- <= 0
      const quote = order.filled.times(order.request.price)
      return {
         orderId: order.orderId,
         status: !closed ? 'open' : order.filled.gte(order.request.quantity) ? 'filled' : order.filled.gt(0) ? 'partial' : 'rejected',
         base: order.filled.toFixed(),
         quote: quote.toFixed(),
         averagePrice: order.request.price,
         fees: order.filled.gt(0) ? { USD: quote.times('0.002').toFixed() } : {},
         reason: closed ? 'User requested' : '',
         postOnlyRefused: closed && order.postOnlyRefused
      }
   }

   async placeStopOrder(): Promise<string> {
      return ''
   }

   async cancelStopOrder(): Promise<void> {}

   async openStopOrders(): Promise<OpenStopOrder[]> {
      return []
   }

   describeError(error: HttpRequesterError): string {
      return String(error.body)
   }

   isAmbiguous(error: HttpRequesterError): boolean {
      return error.statusCode >= 500
   }

   isPostOnlyRefusal(error: HttpRequesterError): boolean {
      return error.body === POST_ONLY_REFUSED
   }
}

const venue = { id: 'kraken', label: 'Kraken' } as Venue

const serviceOver = (exchange: FakeExchange) => new InstantOrderService(venue, exchange)

const buy = (amount: string, extra: Record<string, unknown> = {}) => ({ symbol: 'SOLUSD', side: 'buy', unit: 'base', amount, ...extra })

const refusalOf = async (promise: Promise<unknown>) => {
   try {
      await promise
      return null
   }
   catch (error) {
      if (error instanceof InstantOrderError) return error
      throw error
   }
}

async function until(condition: () => boolean | Promise<boolean>): Promise<void> {
   const deadline = Date.now() + 2000
   while (!await condition()) {
      if (Date.now() > deadline) throw new Error('Timed out waiting for the order.')
      await new Promise(resolve => setTimeout(resolve, 5))
   }
}

const bodyOf = ({ order, state }: TrackedInstantOrder) => ({ order, state })

const stateAfter = async (service: InstantOrderService, tracked: TrackedInstantOrder): Promise<InstantOrderState> =>
   (await service.status({ orders: [tracked] })).states[tracked.order.id]!

describe('placing an instant limit order', () => {

   test('rests a buy one tick under the ask with an id Kraken takes', async () => {
      const exchange = new FakeExchange()

      const { order, state } = await serviceOver(exchange).place({ ...buy('50'), unit: 'quote' })

      expect(order).toMatchObject({ symbol: 'SOLUSD', side: 'buy', quantity: '0.49' })
      expect(state).toMatchObject({ price: '100.49', status: 'open', following: false, current: { orderId: 'O1' } })
      expect(order.id.length).toBeLessThanOrEqual(18)
   })

   test('prices the order again from the new book when the exchange refuses it as a taker', async () => {
      const exchange = new FakeExchange()
      exchange.refusals = 1
      exchange.books = [{ last: '100', bid: '100', ask: '100.5' }, { last: '101', bid: '101', ask: '101.2' }]

      const { state } = await serviceOver(exchange).place({ ...buy('1'), side: 'sell' })

      expect(state.price).toBe('101.01')
   })

   test('gives up when the book keeps moving onto the price', async () => {
      const exchange = new FakeExchange()
      exchange.refusals = 10

      expect((await refusalOf(serviceOver(exchange).place(buy('1'))))?.status).toBe(409)
      expect(exchange.orders.size).toBe(0)
   })

   test('passes on what the exchange answered when it refuses the order', async () => {
      const exchange = new FakeExchange()
      exchange.failure = new HttpRequesterError(400, 'Insufficient funds')

      expect(await refusalOf(serviceOver(exchange).place(buy('1')))).toMatchObject({ status: 409, message: 'Insufficient funds' })
   })

   test('hands back the order without an exchange id when it cannot tell whether it was placed', async () => {
      const exchange = new FakeExchange()
      exchange.failure = new HttpRequesterError(503, 'Busy')

      const { state } = await serviceOver(exchange).place(buy('1'))

      expect(state).toMatchObject({ status: 'unknown', current: { orderId: null }, price: '100.49' })
   })

   test('charges the fee in the asset picked, and keeps it for the rest placed again', async () => {
      const exchange = new FakeExchange()
      const service = serviceOver(exchange)
      const tracked = await service.place({ ...buy('1'), side: 'sell', feeAsset: 'base' })
      exchange.fill(tracked.order.id, '0.4')
      exchange.book = { last: '99', bid: '99', ask: '99.5' }

      await service.reprice(bodyOf(tracked))

      expect(tracked.order.feeAsset).toBe('base')
      expect(exchange.placedOrders().map(({ feeAsset }) => feeAsset)).toEqual(['base', 'base'])
   })

   test('charges the fee where the exchange decides when it lets the order choose nothing', async () => {
      const exchange = new FakeExchange({ choosesFeeAsset: false })

      const { order } = await serviceOver(exchange).place({ ...buy('1'), side: 'sell', feeAsset: 'base' })

      expect(order.feeAsset).toBe('quote')
   })

   test('refuses an amount that is not a positive number, a pair the exchange does not list and a follow with no limit', async () => {
      const service = serviceOver(new FakeExchange())

      expect((await refusalOf(service.place(buy('-1'))))?.status).toBe(400)
      expect((await refusalOf(service.place({ ...buy('1'), symbol: 'DOGEUSD' })))?.status).toBe(400)
      expect((await refusalOf(service.place(buy('1', { follow: true, maxMovePercent: '0' }))))?.status).toBe(400)
   })
})

describe('re-pricing an instant limit order', () => {

   test('amends the price of a part-filled order in place where the exchange can', async () => {
      const exchange = new FakeExchange({ amends: true })
      const service = serviceOver(exchange)
      const tracked = await service.place(buy('1'))
      exchange.fill(tracked.order.id, '0.4')
      exchange.book = { last: '101', bid: '101', ask: '101.5' }

      const { state } = await service.reprice(bodyOf(tracked))

      expect(exchange.amended).toEqual(['101.49'])
      expect(exchange.orders.size).toBe(1)
      expect(state).toMatchObject({ price: '101.49', status: 'open', filled: '0.4', moves: 1, current: { clientOrderId: tracked.order.id } })
   })

   test('cancels a part-filled order and places only what is left where the exchange cannot amend', async () => {
      const exchange = new FakeExchange()
      const service = serviceOver(exchange)
      const tracked = await service.place(buy('1'))
      exchange.fill(tracked.order.id, '0.4')
      exchange.book = { last: '101', bid: '101', ask: '101.5' }

      const { state } = await service.reprice(bodyOf(tracked))

      expect(exchange.placedOrders().at(-1)).toMatchObject({ quantity: '0.6', price: '101.49' })
      expect(state).toMatchObject({ price: '101.49', status: 'open', filled: '0.4', averagePrice: '100.49', moves: 1 })
      expect(state.current.clientOrderId).not.toBe(tracked.order.id)
   })

   test('waits for the exchange to close a cancelled order before answering', async () => {
      const exchange = new FakeExchange()
      const service = serviceOver(exchange)
      const tracked = await service.place(buy('1'))
      exchange.fill(tracked.order.id, '0.4')
      exchange.closesAfterChecks = 1

      const { state } = await service.cancel(bodyOf(tracked))

      expect(state).toMatchObject({ status: 'partial', filled: '0.4', following: false })
   })
})

describe('following the price', () => {

   test('moves the order back inside the spread as the market moves away from it, until it fills', async () => {
      const exchange = new FakeExchange({ amends: true })
      const service = serviceOver(exchange)
      const tracked = await service.place(buy('1', { follow: true, maxMovePercent: '1' }))

      exchange.book = { last: '100.7', bid: '100.7', ask: '100.9' }
      await until(() => exchange.amended.includes('100.89'))
      exchange.fill(tracked.order.id, '1')
      await until(async () => (await stateAfter(service, tracked)).status === 'filled')

      expect(await stateAfter(service, tracked)).toMatchObject({ following: false, filled: '1', price: '100.89' })
   })

   test('never moves further from the first price than allowed', async () => {
      const exchange = new FakeExchange({ amends: true })
      const service = serviceOver(exchange)
      const tracked = await service.place(buy('1', { follow: true, maxMovePercent: '1' }))

      exchange.book = { last: '110', bid: '110', ask: '110.5' }
      await until(() => exchange.amended.length > 0)
      const state = await service.cancel(bodyOf(tracked))

      expect(exchange.amended).toEqual(['101.49'])
      expect(state.state).toMatchObject({ bound: '101.49', following: false, status: 'cancelled' })
   })

   test('places what is left again when the exchange cancels a post-only order that would have taken', async () => {
      const exchange = new FakeExchange()
      const service = serviceOver(exchange)
      const tracked = await service.place(buy('1', { follow: true, maxMovePercent: '1' }))
      exchange.fill(tracked.order.id, '0.25')

      Object.assign(exchange.orders.get(tracked.order.id)!, { closed: true, postOnlyRefused: true })
      await until(() => exchange.orders.size === 2)
      const { state } = await service.cancel(bodyOf(tracked))

      expect(exchange.placedOrders().at(-1)).toMatchObject({ quantity: '0.75' })
      expect(state).toMatchObject({ filled: '0.25', status: 'partial' })
   })

   test('stops when asked, leaving the order where it rests', async () => {
      const exchange = new FakeExchange({ amends: true })
      const service = serviceOver(exchange)
      const tracked = await service.place(buy('1', { follow: true, maxMovePercent: '1' }))

      const { state } = await service.follow({ ...tracked, follow: false })
      exchange.book = { last: '101', bid: '101', ask: '101.5' }
      await new Promise(resolve => setTimeout(resolve, 30))

      expect(state.following).toBe(false)
      expect(exchange.amended).toEqual([])
      await service.cancel(bodyOf(tracked))
   })
})

describe('checking on instant limit orders', () => {

   test('reads the free balances and keeps a buy\'s fee in the cash within them', async () => {
      const account = await serviceOver(new FakeExchange()).account({ symbol: 'SOLUSD' })

      expect(account).toMatchObject({
         freeBase: '2', freeQuote: '1002', choosesFeeAsset: true, feeAssets: { buy: 'quote', sell: 'quote' },
         max: { buy: { quote: '1000', base: '1002' }, sell: { base: '1.99', quote: '2' } },
         fees: { buy: { maker: '0.002', taker: '0.004' } }
      })
   })

   test('picks up an order placed before the server started again from what the page kept', async () => {
      const exchange = new FakeExchange()
      const placed = await serviceOver(exchange).place(buy('1'))
      exchange.fill(placed.order.id, '0.5')
      const kept = { order: { ...placed.order, id: 'io-before-restart' }, state: placed.state }

      const state = await stateAfter(serviceOver(exchange), kept)

      expect(state).toMatchObject({ status: 'open', filled: '0.5', following: false })
   })
})
