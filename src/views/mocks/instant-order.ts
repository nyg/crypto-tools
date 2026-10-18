import { markets, prices, stateOf } from './portfolio'
import type {
   InstantOrder, InstantOrderAccountResponse, InstantOrderActionRequest, InstantOrderActionResponse,
   InstantOrderBookResponse, InstantOrderFollowRequest, InstantOrderMarketsResponse, InstantOrderPlaceRequest,
   InstantOrderPlaceResponse, InstantOrderState, InstantOrderStatusRequest, InstantOrderStatusResponse,
   InstantOrderSymbolRequest
} from '../../types/api'
import type { VenueId } from '../../types/portfolio'

const TICK = 0.01
const FILLS_AFTER_MS = 30_000
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
   venue: VenueId
   order: InstantOrder
   price: number
   following: boolean
   bound: number | null
   moves: number
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

const makerPriceOf = (venue: VenueId, symbol: string, side: 'buy' | 'sell') => {
   const { bid, ask } = bookOf(venue, symbol)
   return side === 'buy' ? ask - TICK : bid + TICK
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
   const freeBase = wallet[market?.base ?? ''] ?? 0
   const kept = (free: number, decimals: number) => (Math.floor(free / (1 + Number(MAKER_FEE)) * 10 ** decimals) / 10 ** decimals).toFixed(decimals)
   return {
      fetchedAt: Date.now(),
      base: market?.base ?? '',
      quote: market?.quote ?? '',
      freeBase: String(freeBase),
      freeQuote: String(freeQuote),
      choosesFeeAsset: venue === 'kraken',
      feeAssets: { buy: venue === 'kraken' ? 'quote' : 'base', sell: 'quote' },
      max: {
         buy: { base: freeQuote.toFixed(2), quote: kept(freeQuote, 2) },
         sell: { base: kept(freeBase, 6), quote: String(freeBase) }
      },
      baseStep: '0.000001',
      minQty: '0.000001',
      minAmount: '5',
      fees: {
         buy: { maker: MAKER_FEE, taker: TAKER_FEE },
         sell: { maker: MAKER_FEE, taker: TAKER_FEE }
      }
   }
}

const boundOf = (side: 'buy' | 'sell', price: number, percent: string) =>
   ticks(price * (1 + (side === 'buy' ? 1 : -1) * Number(percent) / 100))

function follow(entry: MockOrder): void {
   if (!entry.following) return
   const desired = makerPriceOf(entry.venue, entry.order.symbol, entry.order.side)
   const capped = entry.bound === null ? desired
      : entry.order.side === 'buy' ? Math.min(desired, entry.bound) : Math.max(desired, entry.bound)
   const behind = entry.order.side === 'buy' ? capped > entry.price : capped < entry.price
   if (!behind) return
   entry.price = capped
   entry.moves++
}

function stateOfOrder(clientOrderId: string): InstantOrderState {
   const entry = orders.get(clientOrderId)!
   follow(entry)

   const { order, cancelledAt } = entry
   const share = Math.min(1, ((cancelledAt ?? Date.now()) - order.placedAt) / FILLS_AFTER_MS)
   const filled = Number(order.quantity) * (share < 0.4 ? 0 : share)
   const status = share >= 1 ? 'filled' : cancelledAt ? filled > 0 ? 'partial' : 'cancelled' : 'open'
   const fee = filled * entry.price * Number(MAKER_FEE)
   if (status !== 'open') entry.following = false

   return {
      current: { symbol: order.symbol, clientOrderId: order.id, orderId: `mock-${order.id}` },
      price: asPrice(entry.price),
      status,
      following: entry.following,
      bound: entry.bound === null ? null : asPrice(entry.bound),
      moves: entry.moves,
      closed: { base: '0', quote: '0', fees: [] },
      filled: filled.toFixed(6),
      averagePrice: filled > 0 ? asPrice(entry.price) : '0',
      fees: fee > 0 ? [{ asset: order.quote, amount: fee.toFixed(4) }] : [],
      reason: status === 'cancelled' || status === 'partial' ? 'User requested' : ''
   }
}

function place(venue: VenueId, request?: InstantOrderPlaceRequest): InstantOrderPlaceResponse | Promise<never> {
   const market = marketOf(venue, request?.symbol)
   if (!market || !request) return Promise.reject('No such market.')

   const price = makerPriceOf(venue, market.symbol, request.side)
   const amount = Number(request.amount)
   const quantity = Math.floor((request.unit === 'base' ? amount : amount / price) * 1e6) / 1e6
   if (quantity * price < 5) return Promise.reject(`Below the ${market.symbol} minimum of 0.000001 ${market.base} and 5 ${market.quote}.`)

   const order: InstantOrder = {
      id: `io${Date.now().toString(36)}`, symbol: market.symbol, base: market.base, quote: market.quote,
      side: request.side, quantity: String(quantity), placedAt: Date.now(),
      feeAsset: request.feeAsset ?? (venue === 'kraken' || request.side === 'sell' ? 'quote' : 'base')
   }
   orders.set(order.id, {
      venue, order, price, following: request.follow, moves: 0, cancelledAt: null,
      bound: request.follow ? boundOf(request.side, price, request.maxMovePercent) : null
   })
   return { order, state: stateOfOrder(order.id) }
}

const known = (request?: InstantOrderActionRequest) => orders.get(request?.order.id ?? '')

function status(request?: InstantOrderStatusRequest): InstantOrderStatusResponse {
   return {
      fetchedAt: Date.now(),
      states: Object.fromEntries((request?.orders ?? [])
         .filter(({ order }) => orders.has(order.id))
         .map(({ order }) => [order.id, stateOfOrder(order.id)]))
   }
}

function action(request: InstantOrderActionRequest | undefined, change: (entry: MockOrder) => void): InstantOrderActionResponse | Promise<never> {
   const entry = known(request)
   if (!entry) return Promise.reject('The mock forgot this order when the page reloaded.')
   if (stateOfOrder(entry.order.id).status === 'open') change(entry)
   return { state: stateOfOrder(entry.order.id) }
}

const cancel = (request?: InstantOrderActionRequest) => action(request, entry => {
   entry.cancelledAt = Date.now()
   entry.following = false
})

const reprice = (request?: InstantOrderActionRequest) => action(request, entry => {
   entry.price = makerPriceOf(entry.venue, entry.order.symbol, entry.order.side)
   entry.moves++
})

const followOrder = (request?: InstantOrderFollowRequest) => action(request, entry => {
   entry.following = Boolean(request?.follow)
   entry.bound = entry.following ? boundOf(entry.order.side, entry.price, request?.maxMovePercent ?? '1') : entry.bound
})

type Body = { arg?: unknown }
const arg = <T>(params?: Body) => params?.arg as T | undefined

export const instantOrderRoutes: Record<string, (params?: Body) => unknown> = Object.fromEntries(
   (Object.entries(roots) as [VenueId, string][]).flatMap(([venue, root]) => [
      [`${root}/markets`, (): InstantOrderMarketsResponse => ({ markets: markets(venue).markets })],
      [`${root}/book`, (params?: Body) => book(venue, arg(params))],
      [`${root}/account`, (params?: Body) => account(venue, arg(params))],
      [`${root}/place`, (params?: Body) => place(venue, arg(params))],
      [`${root}/status`, (params?: Body) => status(arg(params))],
      [`${root}/cancel`, (params?: Body) => cancel(arg(params))],
      [`${root}/reprice`, (params?: Body) => reprice(arg(params))],
      [`${root}/follow`, (params?: Body) => followOrder(arg(params))]
   ]))
