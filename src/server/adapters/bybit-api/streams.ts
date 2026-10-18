import Big from 'big.js'
import { streamAuth } from './authenticator'
import { ORDERS } from '../websocket/socket-hub'
import type { Inbound, SocketProtocol } from '../websocket/socket-hub'
import type { Credentials } from '../../../types/credentials'
import type { BybitEnvironment, BybitStreamBook, BybitStreamMessage, BybitStreamOrder } from '../../../types/bybit-api'
import type { OrderEvent, SpotPrice } from '../../../types/portfolio'

const PUBLIC_URL = 'wss://stream.bybit.com/v5/public/spot'
const privateUrls: Record<BybitEnvironment, string> = {
   mainnet: 'wss://stream.bybit.com/v5/private',
   demo: 'wss://stream-demo.bybit.com/v5/private'
}
const PING = { everyMs: 20000, message: { op: 'ping' } }
const IDLE_MS = 45000
const OPEN = ['New', 'PartiallyFilled', 'Untriggered', 'Created']
const BOOK_TOPIC = 'orderbook.1.'

const levelOf = (levels: [string, string][] | undefined, previous: string | undefined): string | undefined => {
   if (!levels || levels.length === 0) return previous
   const [price, size] = levels[0]!
   return Big(size || 0).gt(0) ? price : '0'
}

export function bybitBook(previous: SpotPrice | undefined, type: string | undefined, { b, a }: BybitStreamBook): SpotPrice {
   const known = type === 'delta' ? previous : undefined
   const bid = levelOf(b, known?.bid) ?? '0'
   const ask = levelOf(a, known?.ask) ?? '0'
   const last = Big(bid).gt(0) && Big(ask).gt(0) ? Big(bid).plus(ask).div(2).toFixed() : bid
   return { last, bid, ask }
}

export function bybitOrderEvent(order: BybitStreamOrder): OrderEvent | null {
   if ((order.category && order.category !== 'spot') || !order.orderId) return null
   return {
      clientOrderId: order.orderLinkId ?? '',
      orderId: order.orderId,
      closed: !OPEN.includes(order.orderStatus),
      base: order.cumExecQty ?? null,
      quote: order.cumExecValue ?? null
   }
}

export function bybitOrderInbound(message: unknown): Inbound<OrderEvent>[] {
   const { op, success, req_id: requestId, topic, data } = message as BybitStreamMessage
   if (op === 'auth' && success === false) return [{ key: ORDERS, live: false }]
   if (op === 'subscribe' && requestId === ORDERS) return [{ key: ORDERS, live: success === true }]
   if (topic !== 'order' || !Array.isArray(data)) return []

   return (data as BybitStreamOrder[]).flatMap(order => {
      const event = bybitOrderEvent(order)
      return event ? [{ key: ORDERS, value: event }] : []
   })
}

export function bybitBookProtocol(): SocketProtocol<SpotPrice> {

   const books = new Map<string, SpotPrice>()

   return {
      name: 'Bybit book',
      url: PUBLIC_URL,
      idleMs: IDLE_MS,
      ping: PING,
      subscribe: symbols => symbols.map(symbol => ({ op: 'subscribe', req_id: symbol, args: [`${BOOK_TOPIC}${symbol}`] })),
      unsubscribe: symbols => {
         for (const symbol of symbols) books.delete(symbol)
         return [{ op: 'unsubscribe', args: symbols.map(symbol => `${BOOK_TOPIC}${symbol}`) }]
      },
      read: message => {
         const { op, success, req_id: requestId, topic, type, data } = message as BybitStreamMessage
         if (op === 'subscribe' && success === false && requestId) return [{ key: requestId, live: false }]
         if (!topic?.startsWith(BOOK_TOPIC) || !data) return []
         const symbol = topic.slice(BOOK_TOPIC.length)
         const book = bybitBook(books.get(symbol), type, data as BybitStreamBook)
         books.set(symbol, book)
         return [{ key: symbol, value: book }]
      }
   }
}

export const bybitOrderProtocol = (environment: BybitEnvironment, credentials: Credentials): SocketProtocol<OrderEvent> => ({
   name: 'Bybit orders',
   url: privateUrls[environment],
   idleMs: IDLE_MS,
   ping: PING,
   opening: async () => [streamAuth(credentials)],
   subscribe: () => [{ op: 'subscribe', req_id: ORDERS, args: ['order'] }],
   unsubscribe: () => [],
   read: bybitOrderInbound
})
