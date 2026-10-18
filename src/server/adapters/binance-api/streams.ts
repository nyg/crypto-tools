import Big from 'big.js'
import { signedStreamParams } from './authenticator'
import { ORDERS } from '../websocket/socket-hub'
import type { Inbound, SocketProtocol } from '../websocket/socket-hub'
import type { Credentials } from '../../../types/credentials'
import type {
   BinanceEnvironment, BinanceExecutionReport, BinanceStreamBookTicker, BinanceStreamMessage
} from '../../../types/binance-api'
import type { OrderEvent, SpotPrice } from '../../../types/portfolio'

const marketUrls: Record<BinanceEnvironment, string> = {
   mainnet: 'wss://stream.binance.com:9443/ws',
   testnet: 'wss://stream.testnet.binance.vision/ws'
}
const apiUrls: Record<BinanceEnvironment, string> = {
   mainnet: 'wss://ws-api.binance.com:443/ws-api/v3',
   testnet: 'wss://ws-api.testnet.binance.vision/ws-api/v3'
}
const OPEN = ['NEW', 'PARTIALLY_FILLED', 'PENDING_NEW']

const streamOf = (symbol: string) => `${symbol.toLowerCase()}@bookTicker`

export function binanceBookInbound(message: unknown): Inbound<SpotPrice>[] {
   const { id, error } = message as BinanceStreamMessage
   if (id && error) return [{ key: id, live: false }]
   const { s: symbol, b: bid, a: ask } = message as BinanceStreamBookTicker
   if (!symbol || !bid || !ask) return []
   return [{ key: symbol, value: { last: Big(bid).plus(ask).div(2).toFixed(), bid, ask } }]
}

export function binanceOrderEvent(report: BinanceExecutionReport): OrderEvent {
   return {
      clientOrderId: report.C || report.c,
      orderId: String(report.i),
      closed: !OPEN.includes(report.X),
      base: report.z ?? null,
      quote: report.Z ?? null
   }
}

export function binanceOrderInbound(message: unknown): Inbound<OrderEvent>[] {
   const { id, status, event } = message as BinanceStreamMessage
   if (id === ORDERS) return [{ key: ORDERS, live: status === 200 }]
   if (event?.e === 'eventStreamTerminated') return [{ key: ORDERS, live: false }]
   if (event?.e !== 'executionReport') return []
   return [{ key: ORDERS, value: binanceOrderEvent(event as BinanceExecutionReport) }]
}

export const binanceBookProtocol = (environment: BinanceEnvironment): SocketProtocol<SpotPrice> => ({
   name: 'Binance book',
   url: marketUrls[environment],
   subscribe: symbols => symbols.map(symbol => ({ method: 'SUBSCRIBE', params: [streamOf(symbol)], id: symbol })),
   unsubscribe: symbols => [{ method: 'UNSUBSCRIBE', params: symbols.map(streamOf), id: null }],
   read: binanceBookInbound
})

export const binanceOrderProtocol = (environment: BinanceEnvironment, credentials: Credentials): SocketProtocol<OrderEvent> => ({
   name: 'Binance user data',
   url: apiUrls[environment],
   subscribe: () => [{ id: ORDERS, method: 'userDataStream.subscribe.signature', params: signedStreamParams(credentials) }],
   unsubscribe: () => [],
   read: binanceOrderInbound
})
