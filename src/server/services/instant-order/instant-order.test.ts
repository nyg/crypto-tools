import { describe, expect, test } from 'bun:test'
import Big from 'big.js'
import { maxBuy, sizeInstantOrder, stateOf } from './instant-order'
import type { PlanMarket } from '../portfolio/planner'
import type { OrderSettlement } from '../../../types/portfolio'

const btc = (bid: string, ask: string, overrides: Partial<Record<keyof PlanMarket, string>> = {}): PlanMarket => {
   const values = { baseStep: '0.0001', quoteStep: '0.01', tickStep: '0.1', minQty: '0.0001', minAmount: '5', maxQty: '100', maxAmount: '0', ...overrides }
   return {
      symbol: 'BTCUSDT', base: 'BTC', quote: 'USDT', last: Big(bid), bid: Big(bid), ask: Big(ask),
      baseStep: Big(values.baseStep), quoteStep: Big(values.quoteStep), tickStep: Big(values.tickStep),
      minQty: Big(values.minQty), minAmount: Big(values.minAmount), maxQty: Big(values.maxQty), maxAmount: Big(values.maxAmount)
   }
}

const sized = (sizing: ReturnType<typeof sizeInstantOrder>) =>
   'refusal' in sizing ? sizing : { price: sizing.price.toFixed(), quantity: sizing.quantity.toFixed() }

describe('sizing an instant limit order', () => {

   test('buys one tick under the ask and sells one tick over the bid', () => {
      expect(sized(sizeInstantOrder('buy', 'base', Big('0.5'), btc('50000', '50010')))).toEqual({ price: '50009.9', quantity: '0.5' })
      expect(sized(sizeInstantOrder('sell', 'base', Big('0.5'), btc('50000', '50010')))).toEqual({ price: '50000.1', quantity: '0.5' })
   })

   test('joins the best bid or ask when the spread is a single tick', () => {
      expect(sized(sizeInstantOrder('buy', 'base', Big('1'), btc('50000', '50000.1')))).toMatchObject({ price: '50000' })
      expect(sized(sizeInstantOrder('sell', 'base', Big('1'), btc('50000', '50000.1')))).toMatchObject({ price: '50000.1' })
   })

   test('turns a quote amount into what it buys at the limit price, floored to the lot size', () => {
      expect(sized(sizeInstantOrder('buy', 'quote', Big('1000'), btc('49999.8', '50000')))).toEqual({ price: '49999.9', quantity: '0.02' })
   })

   test('refuses an order below the minimum, above the maximum or with no book', () => {
      expect(sizeInstantOrder('buy', 'quote', Big('4'), btc('50000', '50010'))).toHaveProperty('refusal')
      expect(sizeInstantOrder('sell', 'base', Big('101'), btc('50000', '50010'))).toHaveProperty('refusal')
      expect(sizeInstantOrder('buy', 'base', Big('1'), btc('50000', '0'))).toHaveProperty('refusal')
   })
})

describe('the most an order can buy', () => {

   test('leaves room for a fee charged in the cash on top of the order', () => {
      expect(maxBuy(Big('1000'), Big('0.0025'), true, Big('0.01')).toFixed()).toBe('997.5')
   })

   test('spends all of the cash where the fee comes out of the coin bought', () => {
      expect(maxBuy(Big('1000'), Big('0.001'), false, Big('0.01')).toFixed()).toBe('1000')
   })
})

describe('the state of an instant limit order', () => {

   const settlement = (overrides: Partial<OrderSettlement>): OrderSettlement => ({
      orderId: 'O1', status: 'open', base: '0', quote: '0', averagePrice: '0', fees: {}, reason: '', ...overrides
   })

   test('tells an order closed with part of it filled from one closed with nothing filled', () => {
      expect(stateOf(settlement({ status: 'partial', base: '0.2' })).status).toBe('partial')
      expect(stateOf(settlement({ status: 'rejected', base: '0' })).status).toBe('cancelled')
      expect(stateOf(settlement({ status: 'filled', base: '1' })).status).toBe('filled')
   })

   test('says why when the exchange cancelled a post-only order that would have taken', () => {
      expect(stateOf(settlement({ status: 'rejected', postOnlyRefused: true })).reason).toMatch(/taken liquidity/)
   })

   test('lists the fees charged', () => {
      expect(stateOf(settlement({ status: 'filled', base: '1', fees: { USDT: '0.5' } })).fees).toEqual([{ asset: 'USDT', amount: '0.5' }])
   })

   test('is unknown while the exchange has no such order', () => {
      expect(stateOf(null, 'Not found')).toMatchObject({ status: 'unknown', orderId: null, reason: 'Not found' })
   })
})
