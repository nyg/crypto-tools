import { describe, expect, test } from 'bun:test'
import { bybitBook, bybitBookProtocol, bybitOrderInbound } from './streams'

describe('the Bybit book stream', () => {

   test('takes the best level of each side from a snapshot', () => {
      expect(bybitBook(undefined, 'snapshot', { s: 'BTCUSDT', b: [['67000.1', '0.5']], a: [['67000.3', '0.2']] }))
         .toEqual({ last: '67000.2', bid: '67000.1', ask: '67000.3' })
   })

   test('keeps the side a delta leaves out, and empties the one it sizes at zero', () => {
      const previous = { last: '67000.2', bid: '67000.1', ask: '67000.3' }

      expect(bybitBook(previous, 'delta', { s: 'BTCUSDT', b: [['67000.2', '1']] })).toMatchObject({ bid: '67000.2', ask: '67000.3' })
      expect(bybitBook(previous, 'delta', { s: 'BTCUSDT', a: [['67000.3', '0']] })).toMatchObject({ bid: '67000.1', ask: '0' })
   })

   test('reads the symbol from the topic and a refused subscription from its request id', () => {
      const protocol = bybitBookProtocol()

      expect(protocol.read({ topic: 'orderbook.1.SOLUSDT', type: 'snapshot', data: { s: 'SOLUSDT', b: [['150', '3']], a: [['150.01', '2']] } }))
         .toEqual([{ key: 'SOLUSDT', value: { last: '150.005', bid: '150', ask: '150.01' } }])
      expect(protocol.read({ op: 'subscribe', success: false, req_id: 'FOOUSDT', ret_msg: 'Invalid symbol' }))
         .toEqual([{ key: 'FOOUSDT', live: false }])
   })
})

describe('the Bybit order stream', () => {

   test('is live once subscribed, and not when the key is refused', () => {
      expect(bybitOrderInbound({ op: 'subscribe', success: true, req_id: 'orders' })).toEqual([{ key: 'orders', live: true }])
      expect(bybitOrderInbound({ op: 'auth', success: false, ret_msg: 'Invalid apikey' })).toEqual([{ key: 'orders', live: false }])
   })

   test('reads the spot orders only, and closes any that is no longer resting', () => {
      const message = {
         topic: 'order',
         data: [
            { category: 'spot', orderId: '1', orderLinkId: 'io1', orderStatus: 'PartiallyFilled', cumExecQty: '0.4', cumExecValue: '40.2' },
            { category: 'spot', orderId: '2', orderLinkId: 'io2', orderStatus: 'Cancelled', cumExecQty: '0', cumExecValue: '0' },
            { category: 'linear', orderId: '3', orderLinkId: 'x', orderStatus: 'Filled' }
         ]
      }

      expect(bybitOrderInbound(message)).toEqual([
         { key: 'orders', value: { clientOrderId: 'io1', orderId: '1', closed: false, base: '0.4', quote: '40.2' } },
         { key: 'orders', value: { clientOrderId: 'io2', orderId: '2', closed: true, base: '0', quote: '0' } }
      ])
   })
})
