import { describe, expect, test } from 'bun:test'
import { HttpRequesterError } from '../../errors'
import {
   hasKrakenError, krakenErrors, openStops, settlementOf, spotMarkets, spotPrices, spotWallet, takerFeeRate
} from './spot'
import type { KrakenAssetPairs, KrakenOpenOrder } from '../../../types/kraken-api'

const assetPairs: KrakenAssetPairs = {
   XXBTZUSD: {
      altname: 'XBTUSD', wsname: 'XBT/USD', base: 'XXBT', quote: 'ZUSD', lot_decimals: 8, cost_decimals: 5,
      pair_decimals: 1, tick_size: '0.1', ordermin: '0.00005', costmin: '0.5', status: 'online'
   },
   XETHZEUR: {
      altname: 'ETHEUR', wsname: 'ETH/EUR', base: 'XETH', quote: 'ZEUR', lot_decimals: 8, cost_decimals: 5,
      pair_decimals: 2, ordermin: '0.002', costmin: '0.5', status: 'online'
   },
   'XXBTZUSD.d': {
      altname: 'XBTUSD.d', base: 'XXBT', quote: 'ZUSD', lot_decimals: 8, cost_decimals: 5, status: 'online'
   },
   SOLUSDT: {
      altname: 'SOLUSDT', base: 'SOL', quote: 'USDT', lot_decimals: 8, cost_decimals: 5, status: 'cancel_only'
   }
}

const markets = spotMarkets(assetPairs)

const order = (fields: Partial<KrakenOpenOrder>): KrakenOpenOrder => ({
   descr: { pair: 'XBTUSD', type: 'buy', ordertype: 'market' }, vol: '0', vol_exec: '0', cost: '0', fee: '0',
   price: '0', status: 'closed', ...fields
})

describe('Kraken spot markets', () => {

   test('are keyed by normalized asset names, leaving out darkpool and offline pairs', () => {
      expect(markets.map(({ symbol }) => symbol)).toEqual(['BTCUSD', 'ETHEUR'])
   })

   test('carry the pair names orders and tickers use, and steps from the pair decimals', () => {
      expect(markets[0]).toEqual({
         symbol: 'BTCUSD', base: 'BTC', quote: 'USD', pair: 'XXBTZUSD', altname: 'XBTUSD',
         baseStep: '0.00000001', quoteStep: '0.00001', tickStep: '0.1',
         minQty: '0.00005', minAmount: '0.5', maxQty: '0', maxAmount: '0'
      })
   })

   test('fall back to the price decimals when no tick size is given', () => {
      expect(markets[1]!.tickStep).toBe('0.01')
   })
})

describe('Kraken spot prices', () => {

   test('are read from the ticker under the market symbols', () => {
      const prices = spotPrices({
         XXBTZUSD: { a: ['64010.1', '1', '1.000'], b: ['64010.0', '2', '2.000'], c: ['64010.0', '0.001'] },
         ETHEUR: { c: ['2900.00', '0.1'] },
         XDGUSD: { c: ['0.14', '100'] }
      }, markets)

      expect(prices).toEqual({
         BTCUSD: { last: '64010.0', bid: '64010.0', ask: '64010.1' },
         ETHEUR: { last: '2900.00', bid: '2900.00', ask: '2900.00' }
      })
   })
})

describe('the Kraken spot wallet', () => {

   test('counts only spot balances, less what open orders hold', () => {
      expect(spotWallet({
         XXBT: { balance: '0.5000000000', hold_trade: '0.1000000000' },
         'XBT.F': { balance: '1.0000000000' },
         'DOT28.S': { balance: '10.0000000000' },
         ZUSD: { balance: '100.0000', hold_trade: '0.0000' },
         XETH: { balance: '0.0000000000' }
      })).toEqual([
         { asset: 'BTC', total: '0.5', free: '0.4', borrowed: '0' },
         { asset: 'USD', total: '100', free: '100', borrowed: '0' }
      ])
   })
})

describe('a Kraken order settlement', () => {

   test('is filled once a quote-sized market buy closes, with its fee in the quote asset', () => {
      const settlement = settlementOf('OQCLML-BW3P3-BUCMWZ', order({
         vol: '100.00000000', vol_exec: '0.00155800', cost: '99.73', fee: '0.26', price: '64010.0', oflags: 'fciq,viqc'
      }), 'USD')

      expect(settlement).toEqual({
         orderId: 'OQCLML-BW3P3-BUCMWZ', status: 'filled', base: '0.00155800', quote: '99.73',
         averagePrice: '64010.0', fees: { USD: '0.26' }, reason: ''
      })
   })

   test('is still open while the order rests', () => {
      expect(settlementOf('O1', order({ status: 'open' }), 'USD')).toMatchObject({ status: 'open', fees: {} })
   })

   test('is partial when a cancelled order had filled some, and says why', () => {
      expect(settlementOf('O1', order({ status: 'canceled', vol_exec: '0.1', cost: '6400', reason: 'User requested' }), 'USD'))
         .toMatchObject({ status: 'partial', base: '0.1', reason: 'User requested' })
   })

   test('is rejected when nothing filled', () => {
      expect(settlementOf('O1', order({ status: 'expired' }), 'USD')).toMatchObject({ status: 'rejected', reason: 'expired' })
   })
})

describe('the Kraken taker fee', () => {

   test('is the highest rate among the pairs asked about, as a fraction', () => {
      expect(takerFeeRate({ fees: { XZECZUSD: { fee: '0.2500' }, USDCUSD: { fee: '0.1600' } } })).toBe('0.0025')
   })

   test('is unknown when Kraken reports no pair', () => {
      expect(takerFeeRate({})).toBeNull()
   })
})

describe('Kraken open stop orders', () => {

   test('are the stop-loss orders the app placed, under the market symbol', () => {
      const stops = openStops({
         'OABC-1': order({ descr: { pair: 'XBTUSD', ordertype: 'stop-loss', price: '45000.0' }, vol: '0.01', cl_ord_id: 'pf1-stpa1b2c3d4', status: 'open' }),
         'OABC-2': order({ descr: { pair: 'XBTUSD', ordertype: 'limit', price: '60000.0' }, cl_ord_id: 'manual', status: 'open' }),
         'OABC-3': order({ descr: { pair: 'XBTUSD', ordertype: 'stop-loss', price: '40000.0' }, status: 'open' })
      }, markets)

      expect(stops).toEqual([{
         clientOrderId: 'pf1-stpa1b2c3d4', orderId: 'OABC-1', symbol: 'BTCUSD', quantity: '0.01', triggerPrice: '45000.0'
      }])
   })
})

describe('Kraken errors', () => {

   test('are the messages Kraken answered with', () => {
      const error = new HttpRequesterError(200, ['EOrder:Insufficient funds'])
      expect(krakenErrors(error)).toEqual(['EOrder:Insufficient funds'])
      expect(hasKrakenError(error, 'EOrder:Insufficient')).toBe(true)
      expect(krakenErrors(new HttpRequesterError(502, 'Bad gateway'))).toEqual([])
   })
})
