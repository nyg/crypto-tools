import { describe, expect, test } from 'bun:test'
import Big from 'big.js'
import { foldHoldings } from './holdings'
import { PlanError, planPortfolio, splitAmount } from './planner'
import { TargetError, validateTargets } from './targets'
import type { PlanInput, PlanMarket } from './planner'

function market(base: string, price: string, overrides: Partial<Record<keyof PlanMarket, string>> = {}): PlanMarket {
   const values = {
      last: price, bid: price, ask: price,
      baseStep: '0.000001', quoteStep: '0.01',
      minQty: '0.000001', minAmount: '5',
      maxQty: '1000000', maxAmount: '10000000',
      ...overrides
   }
   return {
      symbol: `${base}USDT`, base, quote: 'USDT',
      last: Big(values.last), bid: Big(values.bid), ask: Big(values.ask),
      baseStep: Big(values.baseStep), quoteStep: Big(values.quoteStep),
      minQty: Big(values.minQty), minAmount: Big(values.minAmount),
      maxQty: Big(values.maxQty), maxAmount: Big(values.maxAmount)
   }
}

const bigMap = (entries: Record<string, string>) =>
   new Map(Object.entries(entries).map(([key, value]) => [key, Big(value)]))

function input(overrides: Partial<PlanInput> & { holdingsOf?: Record<string, string>, freeOf?: Record<string, string> }): PlanInput {
   const holdings = bigMap(overrides.holdingsOf ?? {})
   return {
      quote: 'USDT',
      holdings,
      targets: bigMap({ BTC: '50', ETH: '30', USDT: '20' }),
      markets: new Map([['BTC', market('BTC', '50000')], ['ETH', market('ETH', '2500')], ['DOGE', market('DOGE', '0.1')]]),
      free: overrides.freeOf ? bigMap(overrides.freeOf) : new Map(holdings),
      band: Big(1),
      withdraw: Big(0),
      feeRate: Big(0),
      ...overrides
   }
}

const summary = (plan: ReturnType<typeof planPortfolio>) =>
   plan.orders.map(({ asset, side, amount }) => `${side} ${asset} ${amount.toFixed()}`)

describe('the rebalance planner', () => {

   test('invests fresh cash in the target weights and keeps the cash target', () => {
      const plan = planPortfolio(input({ holdingsOf: { USDT: '1000' } }))

      expect(summary(plan)).toEqual(['buy BTC 500', 'buy ETH 300'])
      expect(plan.reserve.toFixed()).toBe('200')
      expect(plan.after.get('BTC')!.toFixed()).toBe('50')
   })

   test('leaves an asset alone while it drifts within the band', () => {
      const plan = planPortfolio(input({ holdingsOf: { BTC: '0.0101', ETH: '0.12', USDT: '195' } }))

      expect(plan.orders.map(({ asset }) => asset)).not.toContain('BTC')
      expect(plan.skipped.map(({ asset, reason }) => `${asset} ${reason}`)).toContain('BTC within-band')
   })

   test('sells an asset that is not a target at all, whatever the band', () => {
      const plan = planPortfolio(input({
         targets: bigMap({ BTC: '100' }),
         holdingsOf: { BTC: '0.02', DOGE: '1234.5' },
         band: Big(50)
      }))

      expect(summary(plan)).toEqual(['sell DOGE 1234.5'])
   })

   test('sells before it buys', () => {
      const plan = planPortfolio(input({ holdingsOf: { BTC: '0.02', USDT: '0' } }))

      expect(plan.orders.map(({ side }) => side)).toEqual(['sell', 'buy'])
   })

   test('skips a trade below the minimum order amount', () => {
      const plan = planPortfolio(input({
         targets: bigMap({ BTC: '50', USDT: '50' }),
         holdingsOf: { BTC: '0.0001', USDT: '6' },
         band: Big(0)
      }))

      expect(plan.orders).toHaveLength(0)
      expect(plan.skipped.map(({ asset, reason }) => `${asset} ${reason}`)).toEqual(['BTC below-minimum'])
   })

   test('rounds quantities down to the lot step', () => {
      const plan = planPortfolio(input({
         targets: bigMap({ USDT: '100' }),
         holdingsOf: { BTC: '0.0123456789' },
         markets: new Map([['BTC', market('BTC', '50000')]])
      }))

      expect(summary(plan)).toEqual(['sell BTC 0.012345'])
   })

   test('splits an order above the maximum market order quantity', () => {
      const plan = planPortfolio(input({
         targets: bigMap({ USDT: '100' }),
         holdingsOf: { BTC: '25' },
         markets: new Map([['BTC', market('BTC', '50000', { maxQty: '10' })]])
      }))

      expect(plan.orders).toHaveLength(3)
      expect(plan.orders.reduce((sum, { amount }) => sum.plus(amount), Big(0)).toFixed()).toBe('25')
      expect(plan.orders.every(({ amount }) => amount.lte(10))).toBe(true)
   })

   test('caps a sell at the free balance when the wallet holds less than the portfolio', () => {
      const plan = planPortfolio(input({
         targets: bigMap({ USDT: '100' }),
         holdingsOf: { BTC: '0.02' },
         freeOf: { BTC: '0.005' }
      }))

      expect(summary(plan)).toEqual(['sell BTC 0.005'])
   })

   test('reports an asset it cannot sell for lack of free balance', () => {
      const plan = planPortfolio(input({
         targets: bigMap({ USDT: '100' }),
         holdingsOf: { BTC: '0.02' },
         freeOf: {}
      }))

      expect(plan.orders).toHaveLength(0)
      expect(plan.skipped.map(({ reason }) => reason)).toEqual(['no-free-balance'])
   })

   test('scales the buys down to the cash that is actually there', () => {
      const plan = planPortfolio(input({
         targets: bigMap({ BTC: '50', ETH: '50' }),
         holdingsOf: { USDT: '1000' },
         freeOf: { USDT: '500' }
      }))

      expect(summary(plan)).toEqual(['buy BTC 250', 'buy ETH 250'])
   })

   test('prices out an asset with no market as unpriced and never trades it', () => {
      const plan = planPortfolio(input({ holdingsOf: { XYZ: '10', USDT: '100' } }))

      expect(plan.skipped.map(({ asset, reason }) => `${asset} ${reason}`)).toContain('XYZ no-market')
      expect(plan.orders.map(({ asset }) => asset)).not.toContain('XYZ')
   })
})

describe('a withdrawal plan', () => {

   test('places no order when the cash already covers it', () => {
      const plan = planPortfolio(input({ holdingsOf: { BTC: '0.01', USDT: '600' }, withdraw: Big(400) }))

      expect(plan.orders).toHaveLength(0)
      expect(plan.cashAfter.toFixed()).toBe('200')
   })

   test('sells the overweight assets to raise what the cash does not cover', () => {
      const plan = planPortfolio(input({
         holdingsOf: { BTC: '0.02', ETH: '0.2', USDT: '0' },
         withdraw: Big(500),
         feeRate: Big('0.001')
      }))

      expect(plan.orders.every(({ side }) => side === 'sell')).toBe(true)
      expect(plan.shortfall.toFixed()).toBe('0')
      expect(plan.cashAfter.gte(0)).toBe(true)
   })

   test('sells everything to withdraw the whole value', () => {
      const plan = planPortfolio(input({
         holdingsOf: { BTC: '0.02', ETH: '0.2', USDT: '100' },
         withdraw: Big(1600)
      }))

      expect(summary(plan)).toEqual(['sell BTC 0.02', 'sell ETH 0.2'])
      expect(plan.cashAfter.toFixed()).toBe('0')
   })

   test('refuses more than the portfolio is worth', () => {
      expect(() => planPortfolio(input({ holdingsOf: { USDT: '100' }, withdraw: Big(101) }))).toThrow(PlanError)
   })
})

describe('splitting an amount', () => {

   test('keeps an amount under the maximum whole', () => {
      expect(splitAmount(Big(5), Big(10), Big('0.1')).map(chunk => chunk.toFixed())).toEqual(['5'])
   })

   test('splits into even chunks that add back up', () => {
      expect(splitAmount(Big(25), Big(10), Big('0.1')).map(chunk => chunk.toFixed())).toEqual(['8.3', '8.3', '8.4'])
   })
})

describe('folding holdings', () => {

   test('applies a buy with its fee charged in the base asset', () => {
      const holdings = foldHoldings(
         [{ asset: 'USDT', amount: '1000' }, { asset: 'BTC', amount: '-0.00001' }],
         [{ side: 'buy', baseAsset: 'BTC', quoteAsset: 'USDT', base: '0.01', quote: '500' }])

      expect(holdings.get('BTC')!.toFixed()).toBe('0.00999')
      expect(holdings.get('USDT')!.toFixed()).toBe('500')
   })

   test('applies a sell with its fee charged in the quote asset', () => {
      const holdings = foldHoldings(
         [{ asset: 'BTC', amount: '0.01' }, { asset: 'USDT', amount: '-0.5' }],
         [{ side: 'sell', baseAsset: 'BTC', quoteAsset: 'USDT', base: '0.01', quote: '500' }])

      expect(holdings.has('BTC')).toBe(false)
      expect(holdings.get('USDT')!.toFixed()).toBe('499.5')
   })

   test('keeps a fee paid in a third coin as a negative holding', () => {
      const holdings = foldHoldings([{ asset: 'USDT', amount: '100' }, { asset: 'MNT', amount: '-0.25' }])

      expect(holdings.get('MNT')!.toFixed()).toBe('-0.25')
   })
})

describe('validating targets', () => {

   const tradable = new Set(['BTC', 'ETH'])

   test('accepts weights that add up to exactly 100', () => {
      expect(validateTargets([{ asset: 'btc', weight: '60.5' }, { asset: 'USDT', weight: '39.5' }], 'USDT', tradable))
         .toEqual([{ asset: 'BTC', weight: '60.5' }, { asset: 'USDT', weight: '39.5' }])
   })

   test('refuses weights that do not add up to 100', () => {
      expect(() => validateTargets([{ asset: 'BTC', weight: '60' }, { asset: 'ETH', weight: '30' }], 'USDT', tradable))
         .toThrow(TargetError)
   })

   test('refuses an asset with no market against the cash coin', () => {
      expect(() => validateTargets([{ asset: 'DOGE', weight: '100' }], 'USDT', tradable)).toThrow(TargetError)
   })

   test('refuses an asset listed twice', () => {
      expect(() => validateTargets([{ asset: 'BTC', weight: '50' }, { asset: 'BTC', weight: '50' }], 'USDT', tradable))
         .toThrow(TargetError)
   })
})
