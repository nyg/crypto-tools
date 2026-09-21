import { describe, expect, test } from 'bun:test'
import { HttpRequesterError } from '../../errors'
import {
   binanceError, hasBinanceCode, openStops, settlementOf, spotAccount, spotMarkets, spotPrices, spotWallet
} from './spot'
import type { BinanceOrder, BinanceSymbol } from '../../../types/binance-api'

const btcusdt: BinanceSymbol = {
   symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', baseAssetPrecision: 8, quoteAssetPrecision: 8,
   status: 'TRADING', isSpotTradingAllowed: true, orderTypes: ['LIMIT', 'MARKET', 'STOP_LOSS'],
   filters: [
      { filterType: 'PRICE_FILTER', tickSize: '0.01000000' },
      { filterType: 'LOT_SIZE', minQty: '0.00001000', maxQty: '9000.00000000', stepSize: '0.00001000' },
      { filterType: 'MARKET_LOT_SIZE', minQty: '0.00000000', maxQty: '76.73128213', stepSize: '0.00000000' },
      { filterType: 'NOTIONAL', minNotional: '5.00000000', maxNotional: '9000000.00000000' }
   ]
}

const order = (fields: Partial<BinanceOrder>): BinanceOrder => ({
   symbol: 'BTCUSDT', orderId: 1, clientOrderId: 'pf1-a1b2c3d4-1', status: 'FILLED', type: 'MARKET', side: 'BUY',
   origQty: '0.00000000', executedQty: '0.00000000', cummulativeQuoteQty: '0.00000000', ...fields
})

describe('Binance spot markets', () => {

   test('take their steps and limits from the symbol filters, preferring the market lot size', () => {
      expect(spotMarkets({ symbols: [btcusdt] })).toEqual([{
         symbol: 'BTCUSDT', base: 'BTC', quote: 'USDT',
         baseStep: '0.00001', quoteStep: '0.00000001', tickStep: '0.01',
         minQty: '0.00001', minAmount: '5', maxQty: '76.73128213', maxAmount: '9000000'
      }])
   })

   test('leave out symbols that are halted, not spot, or refuse market orders', () => {
      const symbols = [
         btcusdt,
         { ...btcusdt, symbol: 'ETHBTC', status: 'BREAK' },
         { ...btcusdt, symbol: 'MARGINUSDT', isSpotTradingAllowed: false },
         { ...btcusdt, symbol: 'LIMITUSDT', orderTypes: ['LIMIT'] }
      ]
      expect(spotMarkets({ symbols }).map(({ symbol }) => symbol)).toEqual(['BTCUSDT'])
   })

   test('read the older minimum notional filter too', () => {
      const legacy = { ...btcusdt, filters: [{ filterType: 'MIN_NOTIONAL', minNotional: '10.00000000' }] }
      expect(spotMarkets({ symbols: [legacy] })[0]).toMatchObject({ minAmount: '10', maxAmount: '0' })
   })
})

describe('Binance spot prices', () => {

   test('pair the last price with the best bid and ask', () => {
      expect(spotPrices(
         [{ symbol: 'BTCUSDT', price: '64000.00' }, { symbol: 'ETHUSDT', price: '3100.00' }],
         [{ symbol: 'BTCUSDT', bidPrice: '63999.99', askPrice: '64000.01' }, { symbol: 'ETHUSDT', bidPrice: '0.00', askPrice: '0.00' }]
      )).toEqual({
         BTCUSDT: { last: '64000.00', bid: '63999.99', ask: '64000.01' },
         ETHUSDT: { last: '3100.00', bid: '3100.00', ask: '3100.00' }
      })
   })
})

describe('the Binance spot account', () => {

   const account = {
      uid: 354937868, canTrade: true,
      balances: [
         { asset: 'BTC', free: '0.10000000', locked: '0.05000000' },
         { asset: 'USDT', free: '0.00000000', locked: '0.00000000' }
      ]
   }

   test('is identified by its uid, or by the key when Binance sends none', () => {
      expect(spotAccount(account, 'hashed-key')).toEqual({ accountId: '354937868', canTrade: true, expiresAt: null })
      expect(spotAccount({ ...account, uid: undefined }, 'hashed-key').accountId).toBe('hashed-key')
   })

   test('holds free and locked coins, leaving out empty balances', () => {
      expect(spotWallet(account)).toEqual([{ asset: 'BTC', total: '0.15', free: '0.1', borrowed: '0' }])
   })
})

describe('a Binance order settlement', () => {

   test('is filled with its fees summed per asset from its own trades', () => {
      const settlement = settlementOf(order({ executedQty: '0.00156000', cummulativeQuoteQty: '99.84000000' }), [
         { orderId: 1, commission: '0.00000156', commissionAsset: 'BTC' },
         { orderId: 1, commission: '0.00000001', commissionAsset: 'BTC' },
         { orderId: 2, commission: '1.00000000', commissionAsset: 'USDT' },
         { orderId: 1, commission: '0.00000000', commissionAsset: 'BNB' }
      ])

      expect(settlement).toEqual({
         orderId: '1', status: 'filled', base: '0.00156', quote: '99.84', averagePrice: '64000',
         fees: { BTC: '0.00000157' }, reason: ''
      })
   })

   test('is open while the order is new or partly filled', () => {
      expect(settlementOf(order({ status: 'NEW' }), []).status).toBe('open')
      expect(settlementOf(order({ status: 'PARTIALLY_FILLED', executedQty: '0.1' }), []).status).toBe('open')
   })

   test('is partial when an expired order filled some, and rejected when it filled nothing', () => {
      expect(settlementOf(order({ status: 'EXPIRED', executedQty: '0.001', cummulativeQuoteQty: '64' }), []))
         .toMatchObject({ status: 'partial', reason: 'EXPIRED' })
      expect(settlementOf(order({ status: 'EXPIRED_IN_MATCH' }), [])).toMatchObject({ status: 'rejected', averagePrice: '0' })
   })
})

describe('Binance open stop orders', () => {

   test('are the resting STOP_LOSS orders', () => {
      expect(openStops([
         order({ orderId: 7, clientOrderId: 'pf1-stpa1b2c3d4', status: 'NEW', type: 'STOP_LOSS', side: 'SELL', origQty: '0.01000000', stopPrice: '45000.00000000' }),
         order({ orderId: 8, status: 'NEW', type: 'LIMIT', side: 'SELL', origQty: '1.00000000' })
      ])).toEqual([{ clientOrderId: 'pf1-stpa1b2c3d4', orderId: '7', symbol: 'BTCUSDT', quantity: '0.01', triggerPrice: '45000' }])
   })
})

describe('Binance errors', () => {

   test('are read from the JSON body Binance answers with', () => {
      const error = new HttpRequesterError(400, '{"code":-2010,"msg":"Account has insufficient balance for requested action."}')
      expect(binanceError(error)).toEqual({ code: -2010, msg: 'Account has insufficient balance for requested action.' })
      expect(hasBinanceCode(error, -2010)).toBe(true)
   })

   test('are unknown when the body is not Binance JSON', () => {
      expect(binanceError(new HttpRequesterError(502, '<html>Bad gateway</html>'))).toBeNull()
      expect(binanceError(new Error('offline'))).toBeNull()
   })
})
