import { describe, expect, test } from 'bun:test'
import { HttpRequesterError } from '../../errors'
import InstantOrderService, { InstantOrderError } from './instant-order-service'
import type { PortfolioExchange } from '../portfolio/exchange'
import type { Venue } from '../portfolio/venues'
import type {
   ExchangeAccount, LimitOrderRequest, OpenStopOrder, OrderLookup, OrderSettlement, SpotCandle, SpotMarket,
   SpotPrice, TradeFees, WalletCoin
} from '../../../types/portfolio'

const POST_ONLY_REFUSED = 'post-only'

class FakeExchange implements PortfolioExchange {

   readonly balanceDecimals = 8
   readonly buyFeeInQuote = true
   readonly chasePacing = { pollMs: 0, moveAfterMs: 0, pollsTakeTurns: false }
   readonly placed: LimitOrderRequest[] = []
   readonly settlements = new Map<string, OrderSettlement>()
   books: SpotPrice[] = [{ last: '100', bid: '100', ask: '100.5' }]
   refusals = 0
   failure: HttpRequesterError | null = null
   closesAfterChecks = 0

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

   async placeLimitOrder(order: LimitOrderRequest): Promise<string> {
      if (this.failure) throw this.failure
      if (this.refusals > 0) {
         this.refusals--
         throw new HttpRequesterError(400, POST_ONLY_REFUSED)
      }
      this.placed.push(order)
      this.settlements.set(order.clientOrderId, {
         orderId: `O${this.placed.length}`, status: 'open', base: '0', quote: '0', averagePrice: '0', fees: {}, reason: ''
      })
      return `O${this.placed.length}`
   }

   async cancelOrder(): Promise<void> {}

   async settleOrder({ clientOrderId }: OrderLookup): Promise<OrderSettlement | null> {
      const settlement = this.settlements.get(clientOrderId)
      if (!settlement || settlement.status !== 'open') return settlement ?? null
      if (this.closesAfterChecks-- > 0) return settlement
      return { ...settlement, status: 'partial', base: '0.4', reason: 'User requested' }
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

describe('placing an instant limit order', () => {

   test('rests a buy one tick under the ask with an id Kraken takes', async () => {
      const exchange = new FakeExchange()

      const { order } = await serviceOver(exchange).place({ symbol: 'SOLUSD', side: 'buy', unit: 'quote', amount: '50' })

      expect(order).toMatchObject({ orderId: 'O1', symbol: 'SOLUSD', side: 'buy', price: '100.49', quantity: '0.49' })
      expect(order.clientOrderId.length).toBeLessThanOrEqual(18)
      expect(exchange.placed).toHaveLength(1)
   })

   test('prices the order again from the new book when the exchange refuses it as a taker', async () => {
      const exchange = new FakeExchange()
      exchange.refusals = 1
      exchange.books = [{ last: '100', bid: '100', ask: '100.5' }, { last: '101', bid: '101', ask: '101.2' }]

      const { order } = await serviceOver(exchange).place({ symbol: 'SOLUSD', side: 'sell', unit: 'base', amount: '1' })

      expect(order.price).toBe('101.01')
   })

   test('gives up when the book keeps moving onto the price', async () => {
      const exchange = new FakeExchange()
      exchange.refusals = 10

      const refusal = await refusalOf(serviceOver(exchange).place({ symbol: 'SOLUSD', side: 'buy', unit: 'base', amount: '1' }))

      expect(refusal?.status).toBe(409)
      expect(exchange.placed).toHaveLength(0)
   })

   test('passes on what the exchange answered when it refuses the order', async () => {
      const exchange = new FakeExchange()
      exchange.failure = new HttpRequesterError(400, 'Insufficient funds')

      const refusal = await refusalOf(serviceOver(exchange).place({ symbol: 'SOLUSD', side: 'buy', unit: 'base', amount: '1' }))

      expect(refusal).toMatchObject({ status: 409, message: 'Insufficient funds' })
   })

   test('hands back the order without an exchange id when it cannot tell whether it was placed', async () => {
      const exchange = new FakeExchange()
      exchange.failure = new HttpRequesterError(503, 'Busy')

      const { order } = await serviceOver(exchange).place({ symbol: 'SOLUSD', side: 'buy', unit: 'base', amount: '1' })

      expect(order).toMatchObject({ orderId: null, price: '100.49' })
   })

   test('refuses an amount that is not a positive number and a pair the exchange does not list', async () => {
      const service = serviceOver(new FakeExchange())

      expect((await refusalOf(service.place({ symbol: 'SOLUSD', side: 'buy', unit: 'base', amount: '-1' })))?.status).toBe(400)
      expect((await refusalOf(service.place({ symbol: 'DOGEUSD', side: 'buy', unit: 'base', amount: '1' })))?.status).toBe(400)
   })
})

describe('following an instant limit order', () => {

   test('reads the free balances and keeps a buy\'s fee in the cash within them', async () => {
      const account = await serviceOver(new FakeExchange()).account({ symbol: 'SOLUSD' })

      expect(account).toMatchObject({ freeBase: '2', freeQuote: '1002', maxBuy: '1000', fees: { buy: { maker: '0.002', taker: '0.004' } } })
   })

   test('waits for the exchange to close a cancelled order before answering', async () => {
      const exchange = new FakeExchange()
      const service = serviceOver(exchange)
      const { order } = await service.place({ symbol: 'SOLUSD', side: 'buy', unit: 'base', amount: '1' })
      exchange.closesAfterChecks = 1

      const { state } = await service.cancel({ order })

      expect(state).toMatchObject({ status: 'partial', filled: '0.4' })
   })

   test('reports each order asked about by its client id', async () => {
      const exchange = new FakeExchange()
      const service = serviceOver(exchange)
      const { order } = await service.place({ symbol: 'SOLUSD', side: 'buy', unit: 'base', amount: '1' })
      exchange.closesAfterChecks = 1

      const { states } = await service.status({ orders: [order, { symbol: 'SOLUSD', clientOrderId: 'gone', orderId: null }] })

      expect(states[order.clientOrderId]?.status).toBe('open')
      expect(states.gone?.status).toBe('unknown')
   })
})
