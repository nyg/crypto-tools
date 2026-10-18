import { describe, expect, test } from 'bun:test'
import { krakenExecutionInbound, krakenStreamSymbol, krakenTickerInbound } from './streams'

describe('the Kraken book stream', () => {

   test('names a market by its assets, BTC rather than XBT', () => {
      expect(krakenStreamSymbol({ base: 'BTC', quote: 'USD' })).toBe('BTC/USD')
   })

   test('reads the best bid and ask of each ticker entry as exact decimals', () => {
      const message = {
         channel: 'ticker', type: 'update',
         data: [{ symbol: 'BTC/USD', bid: 67012.3, ask: 67012.4, last: 67012.4 }, { symbol: 'SHIB/USD', bid: 1.2e-7, ask: 1.3e-7 }]
      }

      expect(krakenTickerInbound(message)).toEqual([
         { key: 'BTC/USD', value: { last: '67012.4', bid: '67012.3', ask: '67012.4' } },
         { key: 'SHIB/USD', value: { last: '0.00000012', bid: '0.00000012', ask: '0.00000013' } }
      ])
   })

   test('marks a pair it refused as not live, and ignores heartbeats and acknowledgements', () => {
      expect(krakenTickerInbound({ method: 'subscribe', success: false, error: 'Currency pair not supported', symbol: 'FOO/USD' }))
         .toEqual([{ key: 'FOO/USD', live: false }])
      expect(krakenTickerInbound({ channel: 'heartbeat' })).toEqual([])
      expect(krakenTickerInbound({ method: 'subscribe', success: true, result: { channel: 'ticker', symbol: 'BTC/USD' } })).toEqual([])
   })
})

describe('the Kraken executions stream', () => {

   test('is live once the subscription is acknowledged, and not when it is refused', () => {
      expect(krakenExecutionInbound({ method: 'subscribe', success: true, result: { channel: 'executions' } }))
         .toEqual([{ key: 'orders', live: true }])
      expect(krakenExecutionInbound({ method: 'subscribe', success: false, error: 'EGeneral:Invalid arguments:token' }))
         .toEqual([{ key: 'orders', live: false }])
   })

   test('follows what an order filled until it closes', () => {
      const message = {
         channel: 'executions', type: 'update',
         data: [
            { order_id: 'OA', cl_ord_id: 'io1', exec_type: 'trade', order_status: 'partially_filled', cum_qty: 0.25, cum_cost: 25.1 },
            { order_id: 'OA', cl_ord_id: 'io1', exec_type: 'filled', order_status: 'filled', cum_qty: 1, cum_cost: 100.4 },
            { order_id: 'OB', exec_type: 'canceled', order_status: 'canceled' },
            { order_id: 'OC', exec_type: 'amended' }
         ]
      }

      expect(krakenExecutionInbound(message).map(inbound => 'value' in inbound && inbound.value)).toEqual([
         { clientOrderId: 'io1', orderId: 'OA', closed: false, base: '0.25', quote: '25.1' },
         { clientOrderId: 'io1', orderId: 'OA', closed: true, base: '1', quote: '100.4' },
         { clientOrderId: '', orderId: 'OB', closed: true, base: null, quote: null },
         { clientOrderId: '', orderId: 'OC', closed: false, base: null, quote: null }
      ])
   })
})
