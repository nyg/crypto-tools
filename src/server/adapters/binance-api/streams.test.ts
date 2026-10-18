import { describe, expect, test } from 'bun:test'
import { binanceBookInbound, binanceOrderInbound } from './streams'

describe('the Binance book stream', () => {

   test('reads the best bid and ask of a book ticker', () => {
      expect(binanceBookInbound({ u: 400900217, s: 'BNBUSDT', b: '25.35190000', B: '31.21', a: '25.36520000', A: '40.66' }))
         .toEqual([{ key: 'BNBUSDT', value: { last: '25.35855', bid: '25.35190000', ask: '25.36520000' } }])
   })

   test('marks a refused subscription as not live and ignores its acknowledgement', () => {
      expect(binanceBookInbound({ id: 'FOOUSDT', error: { code: 2, msg: 'Invalid request' } })).toEqual([{ key: 'FOOUSDT', live: false }])
      expect(binanceBookInbound({ id: 'BNBUSDT', result: null })).toEqual([])
   })
})

describe('the Binance user data stream', () => {

   test('is live once the subscription answers 200, and no longer once the stream is terminated', () => {
      expect(binanceOrderInbound({ id: 'orders', status: 200, result: { subscriptionId: 0 } })).toEqual([{ key: 'orders', live: true }])
      expect(binanceOrderInbound({ id: 'orders', status: 401, error: { code: -1022 } })).toEqual([{ key: 'orders', live: false }])
      expect(binanceOrderInbound({ subscriptionId: 0, event: { e: 'eventStreamTerminated' } })).toEqual([{ key: 'orders', live: false }])
   })

   test('names a cancelled order by its own client id, not the cancel request\'s', () => {
      const report = (fields: Record<string, unknown>) => ({ subscriptionId: 0, event: { e: 'executionReport', s: 'BTCUSDT', i: 42, C: '', ...fields } })

      expect(binanceOrderInbound(report({ c: 'io1', X: 'PARTIALLY_FILLED', z: '0.1', Z: '6700' }))).toEqual([
         { key: 'orders', value: { clientOrderId: 'io1', orderId: '42', closed: false, base: '0.1', quote: '6700' } }
      ])
      expect(binanceOrderInbound(report({ c: 'web_cancel', C: 'io1', X: 'CANCELED', z: '0.1', Z: '6700' }))).toEqual([
         { key: 'orders', value: { clientOrderId: 'io1', orderId: '42', closed: true, base: '0.1', quote: '6700' } }
      ])
   })

   test('ignores the other account events', () => {
      expect(binanceOrderInbound({ subscriptionId: 0, event: { e: 'outboundAccountPosition' } })).toEqual([])
   })
})
