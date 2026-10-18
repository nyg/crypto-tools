import { describe, expect, test } from 'bun:test'
import Big from 'big.js'
import { addFill, closedStatus, fillOf, maxBuy, noFill, sizeInstantOrder, sizeRest, summaryOf, wireFill } from './instant-order'
import type { PlanMarket } from '../portfolio/planner'

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

describe('placing what is left of an order', () => {

   test('floors the rest to the lot size at the new price', () => {
      expect(sized(sizeRest(Big('0.61234'), Big('50000'), btc('50000', '50010')))).toEqual({ price: '50000', quantity: '0.6123' })
   })

   test('refuses a rest below the minimum', () => {
      expect(sizeRest(Big('0.00005'), Big('50000'), btc('50000', '50010'))).toHaveProperty('refusal')
   })
})

describe('what an order filled across its attempts', () => {

   test('adds up the base, the quote and each fee asset of every attempt', () => {
      const fill = addFill(addFill(noFill(), { base: '0.4', quote: '40', fees: { USD: '0.1' } }), { base: '0.6', quote: '61.2', fees: { USD: '0.2' } })

      expect(summaryOf(fill)).toEqual({ filled: '1', averagePrice: '101.2', fees: [{ asset: 'USD', amount: '0.3' }] })
   })

   test('survives the round trip through the page', () => {
      const fill = addFill(noFill(), { base: '0.4', quote: '40', fees: { SOL: '0.0004' } })

      expect(wireFill(fillOf(wireFill(fill)))).toEqual(wireFill(fill))
   })

   test('tells a filled order from one closed with part or nothing filled', () => {
      expect(closedStatus(Big('1'), Big('1'))).toBe('filled')
      expect(closedStatus(Big('1'), Big('0.4'))).toBe('partial')
      expect(closedStatus(Big('1'), Big('0'))).toBe('cancelled')
   })
})
