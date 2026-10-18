import Big from 'big.js'
import { ORDERS } from '../websocket/socket-hub'
import type { Inbound, SocketProtocol } from '../websocket/socket-hub'
import type { KrakenStreamExecution, KrakenStreamMessage, KrakenStreamTicker } from '../../../types/kraken-api'
import type { OrderEvent, SpotMarket, SpotPrice } from '../../../types/portfolio'

const PUBLIC_URL = 'wss://ws.kraken.com/v2'
const PRIVATE_URL = 'wss://ws-auth.kraken.com/v2'
const IDLE_MS = 30000
const CLOSED = ['filled', 'canceled', 'expired']

const decimal = (value: number | undefined): string | null =>
   typeof value === 'number' && Number.isFinite(value) ? Big(value).toFixed() : null

export const krakenStreamSymbol = ({ base, quote }: Pick<SpotMarket, 'base' | 'quote'>) => `${base}/${quote}`

export function krakenTickerInbound(message: unknown): Inbound<SpotPrice>[] {
   const { channel, data, method, success, symbol } = message as KrakenStreamMessage
   if (method === 'subscribe' && success === false && symbol) return [{ key: symbol, live: false }]
   if (channel !== 'ticker' || !Array.isArray(data)) return []

   return (data as KrakenStreamTicker[]).flatMap(entry => {
      const bid = decimal(entry.bid)
      const ask = decimal(entry.ask)
      if (!entry.symbol || !bid || !ask) return []
      return [{ key: entry.symbol, value: { last: decimal(entry.last) ?? bid, bid, ask } }]
   })
}

export function krakenOrderEvent(execution: KrakenStreamExecution): OrderEvent | null {
   if (!execution.order_id) return null
   const status = execution.order_status ?? execution.exec_type ?? ''
   return {
      clientOrderId: execution.cl_ord_id ?? '',
      orderId: execution.order_id,
      closed: CLOSED.includes(status),
      base: decimal(execution.cum_qty),
      quote: decimal(execution.cum_cost)
   }
}

export function krakenExecutionInbound(message: unknown): Inbound<OrderEvent>[] {
   const { channel, data, method, success, result } = message as KrakenStreamMessage
   if (method === 'subscribe' && (success === false || result?.channel === 'executions')) return [{ key: ORDERS, live: success === true }]
   if (channel !== 'executions' || !Array.isArray(data)) return []

   return (data as KrakenStreamExecution[]).flatMap(execution => {
      const event = krakenOrderEvent(execution)
      return event ? [{ key: ORDERS, value: event }] : []
   })
}

export const krakenBookProtocol = (): SocketProtocol<SpotPrice> => ({
   name: 'Kraken book',
   url: PUBLIC_URL,
   idleMs: IDLE_MS,
   subscribe: symbols => [{ method: 'subscribe', params: { channel: 'ticker', symbol: symbols, event_trigger: 'bbo', snapshot: true } }],
   unsubscribe: symbols => [{ method: 'unsubscribe', params: { channel: 'ticker', symbol: symbols, event_trigger: 'bbo' } }],
   read: krakenTickerInbound
})

export const krakenOrderProtocol = (token: () => Promise<string>): SocketProtocol<OrderEvent> => ({
   name: 'Kraken executions',
   url: PRIVATE_URL,
   idleMs: IDLE_MS,
   subscribe: async () => [{
      method: 'subscribe',
      params: { channel: 'executions', token: await token(), snap_orders: true, snap_trades: false }
   }],
   unsubscribe: () => [],
   read: krakenExecutionInbound
})
