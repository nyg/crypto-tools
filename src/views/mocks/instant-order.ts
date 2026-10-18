import { markets, prices, stateOf } from './portfolio'
import type {
   InstantOrder, InstantOrderAccountResponse, InstantOrderBookResponse, InstantOrderCancelRequest,
   InstantOrderCancelResponse, InstantOrderMarketsResponse, InstantOrderPlaceRequest, InstantOrderPlaceResponse,
   InstantOrderState, InstantOrderStatusRequest, InstantOrderStatusResponse, InstantOrderSymbolRequest
} from '../../types/api'
import type { VenueId } from '../../types/portfolio'

const TICK = 0.01
const FILLS_AFTER_MS = 12_000
const MAKER_FEE = '0.0004'
const TAKER_FEE = '0.001'

const roots: Record<VenueId, string> = {
   bybit: '/api/bybit/instant-orders',
   bybitDemo: '/api/bybit/demo/instant-orders',
   kraken: '/api/kraken/instant-orders',
   binance: '/api/binance/instant-orders',
   binanceTestnet: '/api/binance/testnet/instant-orders'
}

interface MockOrder {
   order: InstantOrder
   cancelledAt: number | null
}

const orders = new Map<string, MockOrder>()

const marketOf = (venue: VenueId, symbol = '') => markets(venue).markets.find(entry => entry.symbol === symbol)

const ticks = (value: number) => Math.round(value / TICK) * TICK
const asPrice = (value: number) => ticks(value).toFixed(2)

function bookOf(venue: VenueId, symbol?: string) {
   const market = marketOf(venue, symbol)
   const mid = market ? (prices[market.base] ?? 0) / (prices[market.quote] ?? 1) : 0
   const drift = Math.sin(Date.now() / 20_000) * mid * 0.0005
   const bid = ticks(mid + drift)
   return { bid, ask: bid + 4 * TICK }
}

function book(venue: VenueId, request?: InstantOrderSymbolRequest): InstantOrderBookResponse {
   const { bid, ask } = bookOf(venue, request?.symbol)
   return {
      fetchedAt: Date.now(),
      bid: asPrice(bid),
      ask: asPrice(ask),
      buyPrice: asPrice(ask - TICK),
      sellPrice: asPrice(bid + TICK)
   }
}

function account(venue: VenueId, request?: InstantOrderSymbolRequest): InstantOrderAccountResponse {
   const market = marketOf(venue, request?.symbol)
   const wallet = stateOf(venue).wallet
   const freeQuote = wallet[market?.quote ?? ''] ?? 0
   return {
      fetchedAt: Date.now(),
      base: market?.base ?? '',
      quote: market?.quote ?? '',
      freeBase: String(wallet[market?.base ?? ''] ?? 0),
      freeQuote: String(freeQuote),
      maxBuy: (Math.floor(freeQuote * 100) / 100).toFixed(2),
      baseStep: '0.000001',
      minQty: '0.000001',
      minAmount: '5',
      fees: {
         buy: { maker: MAKER_FEE, taker: TAKER_FEE },
         sell: { maker: MAKER_FEE, taker: TAKER_FEE }
      }
   }
}

function place(venue: VenueId, request?: InstantOrderPlaceRequest): InstantOrderPlaceResponse | Promise<never> {
   const market = marketOf(venue, request?.symbol)
   if (!market || !request) return Promise.reject('No such market.')

   const { bid, ask } = bookOf(venue, market.symbol)
   const price = request.side === 'buy' ? ask - TICK : bid + TICK
   const amount = Number(request.amount)
   const quantity = Math.floor((request.unit === 'base' ? amount : amount / price) * 1e6) / 1e6
   if (quantity * price < 5) return Promise.reject(`Below the ${market.symbol} minimum of 0.000001 ${market.base} and 5 ${market.quote}.`)

   const clientOrderId = `io${Date.now().toString(36)}`
   const order: InstantOrder = {
      clientOrderId, orderId: `mock-${orders.size + 1}`, symbol: market.symbol, base: market.base, quote: market.quote,
      side: request.side, quantity: String(quantity), price: asPrice(price), placedAt: Date.now()
   }
   orders.set(clientOrderId, { order, cancelledAt: null })
   return { order }
}

function stateOfOrder(clientOrderId: string): InstantOrderState {
   const entry = orders.get(clientOrderId)
   if (!entry) return { orderId: null, status: 'unknown', filled: '0', averagePrice: '0', fees: [], reason: '' }

   const { order, cancelledAt } = entry
   const share = Math.min(1, ((cancelledAt ?? Date.now()) - order.placedAt) / FILLS_AFTER_MS)
   const filled = Number(order.quantity) * (share < 0.5 ? 0 : share)
   const status = share >= 1 ? 'filled' : cancelledAt ? filled > 0 ? 'partial' : 'cancelled' : 'open'
   const fee = filled * Number(order.price) * Number(MAKER_FEE)

   return {
      orderId: order.orderId,
      status,
      filled: filled.toFixed(6),
      averagePrice: filled > 0 ? order.price : '0',
      fees: fee > 0 ? [{ asset: order.quote, amount: fee.toFixed(4) }] : [],
      reason: status === 'cancelled' || status === 'partial' ? 'User requested' : ''
   }
}

function status(request?: InstantOrderStatusRequest): InstantOrderStatusResponse {
   return {
      fetchedAt: Date.now(),
      states: Object.fromEntries((request?.orders ?? []).map(({ clientOrderId }) => [clientOrderId, stateOfOrder(clientOrderId)]))
   }
}

function cancel(request?: InstantOrderCancelRequest): InstantOrderCancelResponse {
   const clientOrderId = request?.order.clientOrderId ?? ''
   const entry = orders.get(clientOrderId)
   if (entry && stateOfOrder(clientOrderId).status === 'open') entry.cancelledAt = Date.now()
   return { state: stateOfOrder(clientOrderId) }
}

type Body = { arg?: unknown }
const arg = <T>(params?: Body) => params?.arg as T | undefined

export const instantOrderRoutes: Record<string, (params?: Body) => unknown> = Object.fromEntries(
   (Object.entries(roots) as [VenueId, string][]).flatMap(([venue, root]) => [
      [`${root}/markets`, (): InstantOrderMarketsResponse => ({ markets: markets(venue).markets })],
      [`${root}/book`, (params?: Body) => book(venue, arg(params))],
      [`${root}/account`, (params?: Body) => account(venue, arg(params))],
      [`${root}/place`, (params?: Body) => place(venue, arg(params))],
      [`${root}/status`, (params?: Body) => status(arg(params))],
      [`${root}/cancel`, (params?: Body) => cancel(arg(params))]
   ]))
