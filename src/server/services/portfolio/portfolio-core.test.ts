import { describe, expect, test } from 'bun:test'
import Big from 'big.js'
import { foldHoldings } from './holdings'
import { orderFee, PlanError, planPortfolio, splitAmount } from './planner'
import { foldPositions } from './positions'
import { planStops, stopActions } from './stops'
import { moveWeightToCash, TargetError, validateTargets } from './targets'
import type { PlanInput, PlanMarket } from './planner'
import type { PositionMovement, PositionOrder } from './positions'

function market(base: string, price: string, overrides: Partial<Record<keyof PlanMarket, string>> = {}): PlanMarket {
   const values = {
      last: price, bid: price, ask: price,
      baseStep: '0.000001', quoteStep: '0.01', tickStep: '0.01',
      minQty: '0.000001', minAmount: '5',
      maxQty: '1000000', maxAmount: '10000000',
      ...overrides
   }
   return {
      symbol: `${base}USDT`, base, quote: 'USDT',
      last: Big(values.last), bid: Big(values.bid), ask: Big(values.ask),
      baseStep: Big(values.baseStep), quoteStep: Big(values.quoteStep), tickStep: Big(values.tickStep),
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

   test('spends cash above its band on the underweight targets, even within their own band', () => {
      const plan = planPortfolio(input({ holdingsOf: { BTC: '0.0098', ETH: '0.116', USDT: '220' } }))

      expect(summary(plan)).toEqual(['buy BTC 10', 'buy ETH 10'])
   })

   test('raises cash below its band from the overweight targets, even within their own band', () => {
      const plan = planPortfolio(input({ holdingsOf: { BTC: '0.0102', ETH: '0.124', USDT: '180' } }))

      expect(summary(plan)).toEqual(['sell BTC 0.0002', 'sell ETH 0.004'])
   })

   test('holds cash the portfolio does not target to a band around zero', () => {
      const plan = planPortfolio(input({
         targets: bigMap({ BTC: '60', ETH: '40' }),
         holdingsOf: { BTC: '0.0117', ETH: '0.156', USDT: '25' },
         band: Big(2)
      }))

      expect(summary(plan)).toEqual(['buy BTC 15', 'buy ETH 10'])
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

   test('trims the overweights within their band, largest first, to fund a buy outside it', () => {
      const plan = planPortfolio(input({
         targets: bigMap({ BTC: '45', ETH: '45', DOGE: '10' }),
         holdingsOf: { BTC: '0.0096', ETH: '0.2', USDT: '20' },
         band: Big(5)
      }))

      expect(summary(plan)).toEqual(['sell ETH 0.02', 'sell BTC 0.0006', 'buy DOGE 100'])
      expect(plan.skipped).toEqual([])
   })

   test('trims only what the buy needs', () => {
      const plan = planPortfolio(input({
         targets: bigMap({ BTC: '45', ETH: '45', DOGE: '10' }),
         holdingsOf: { BTC: '0.0098', ETH: '0.176', USDT: '70' },
         band: Big(8)
      }))

      expect(summary(plan)).toEqual(['sell BTC 0.0006', 'buy DOGE 100'])
      expect(plan.skipped.map(({ asset, reason }) => `${asset} ${reason}`)).toEqual(['ETH within-band'])
   })

   test('trims an overweight back to its target when the part the buy needs is below the minimum', () => {
      const plan = planPortfolio(input({
         targets: bigMap({ BTC: '45', ETH: '45', DOGE: '10' }),
         holdingsOf: { BTC: '0.0092', ETH: '0.1768', USDT: '98' },
         band: Big('9.9')
      }))

      expect(summary(plan)).toEqual(['sell BTC 0.0002', 'buy DOGE 100'])
   })

   test('sells a little past the target to pay the fees, so the buy reaches its target', () => {
      const plan = planPortfolio(input({
         targets: bigMap({ BTC: '50', ETH: '50' }),
         holdingsOf: { BTC: '0.0022', ETH: '0.036', USDT: '0' },
         band: Big(2),
         feeRate: Big('0.0025'),
         buyFeeInQuote: true
      }))

      expect(summary(plan)).toEqual(['sell BTC 0.000202', 'buy ETH 10'])
      expect(plan.cashAfter.gte(0)).toBe(true)
   })

   test('never sells past the band to pay the fees', () => {
      const plan = planPortfolio(input({
         targets: bigMap({ BTC: '50', ETH: '50' }),
         holdingsOf: { BTC: '0.0022', ETH: '0.036', USDT: '0' },
         band: Big(2),
         feeRate: Big('0.5')
      }))

      expect(summary(plan)).toEqual(['sell BTC 0.00028', 'buy ETH 7'])
   })

   test('rounds a buy below the minimum up to it while the coin stays within the band', () => {
      const plan = planPortfolio(input({
         targets: bigMap({ BTC: '50', ETH: '50' }),
         holdingsOf: { BTC: '0.0034', ETH: '0.06', USDT: '0' },
         markets: new Map([['BTC', market('BTC', '50000')], ['ETH', market('ETH', '2500', { minQty: '0.006' })]]),
         band: Big(2)
      }))

      expect(summary(plan)).toEqual(['sell BTC 0.0003', 'buy ETH 15'])
   })

   test('leaves a buy below the minimum alone when rounding it up would overshoot the band', () => {
      const plan = planPortfolio(input({
         targets: bigMap({ BTC: '50', ETH: '50' }),
         holdingsOf: { BTC: '0.0034', ETH: '0.06', USDT: '0' },
         markets: new Map([['BTC', market('BTC', '50000')], ['ETH', market('ETH', '2500', { minQty: '0.006' })]]),
         band: Big(1)
      }))

      expect(summary(plan)).toEqual(['sell BTC 0.0002'])
      expect(plan.skipped.map(({ asset, reason }) => `${asset} ${reason}`)).toEqual(['ETH below-minimum'])
   })

   test('charges each coin its own buy rate', () => {
      const plan = planPortfolio(input({
         targets: bigMap({ BTC: '50', ETH: '50' }),
         holdingsOf: { USDT: '300' },
         feeRates: new Map([['BTC', { buy: Big('0.01'), sell: Big('0.01') }], ['ETH', { buy: Big('0.02'), sell: Big('0.02') }]]),
         buyFeeInQuote: true
      }))

      expect(summary(plan)).toEqual(['buy BTC 147.78', 'buy ETH 147.78'])
      expect(plan.cashAfter.toFixed()).toBe('0.0066')
   })

   test('prices each fee in the coin the exchange charges it in', () => {
      const plan = planPortfolio(input({ holdingsOf: { BTC: '0.02', USDT: '0' } }))
      const [sell, buy] = plan.orders
      const feeOf = (order: typeof sell, inQuote: boolean) => {
         const fee = orderFee(order!, 'USDT', Big('0.001'), inQuote)
         return `${fee.amount.toFixed()} ${fee.asset}`
      }

      expect(summary(plan)).toEqual(['sell BTC 0.01', 'buy ETH 300'])
      expect(feeOf(sell, false)).toBe('0.5 USDT')
      expect(feeOf(buy, false)).toBe('0.00012 ETH')
      expect(feeOf(buy, true)).toBe('0.3 USDT')
   })

   test('reports a buy the cash cannot fund as short of cash, not below the minimum', () => {
      const plan = planPortfolio(input({
         targets: bigMap({ BTC: '40', ETH: '40', DOGE: '20' }),
         holdingsOf: { BTC: '0.0099', ETH: '0.2', USDT: '4' },
         freeOf: { USDT: '4' },
         band: Big(10)
      }))

      expect(plan.orders).toHaveLength(0)
      expect(plan.skipped.map(({ asset, reason }) => `${asset} ${reason}`)).toContain('DOGE no-cash')
   })

   test('spends all the cash when the buy fee comes out of the coin bought', () => {
      const plan = planPortfolio(input({
         targets: bigMap({ BTC: '50', ETH: '50' }),
         holdingsOf: { USDT: '300' },
         feeRate: Big('0.0025')
      }))

      expect(summary(plan)).toEqual(['buy BTC 150', 'buy ETH 150'])
      expect(plan.cashAfter.toFixed()).toBe('0')
   })

   test('leaves room for the buy fee when it comes out of the cash', () => {
      const plan = planPortfolio(input({
         targets: bigMap({ BTC: '50', ETH: '50' }),
         holdingsOf: { USDT: '300' },
         feeRate: Big('0.0025'),
         buyFeeInQuote: true
      }))

      expect(summary(plan)).toEqual(['buy BTC 149.62', 'buy ETH 149.62'])
      expect(plan.cashAfter.toFixed()).toBe('0.0119')
      expect(plan.shortfall.toFixed()).toBe('0')
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

   test('raises the whole amount net of fees, rounding each sell up to its lot step', () => {
      const plan = planPortfolio(input({
         targets: bigMap({ BTC: '50', ETH: '50' }),
         holdingsOf: { BTC: '0.02', ETH: '0.4', USDT: '0' },
         markets: new Map([
            ['BTC', market('BTC', '50000', { baseStep: '0.0001' })],
            ['ETH', market('ETH', '2500', { baseStep: '0.001' })]
         ]),
         withdraw: Big(500),
         feeRate: Big('0.001')
      }))

      expect(summary(plan)).toEqual(['sell BTC 0.0051', 'sell ETH 0.101'])
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

   test('rounds down to the precision the exchange reports balances in', () => {
      const holdings = foldHoldings(
         [{ asset: 'USDT', amount: '800' }, { asset: 'PUMP', amount: '-194.269062651772705196' }],
         [{ side: 'buy', baseAsset: 'PUMP', quoteAsset: 'USDT', base: '194269.062651772705196697', quote: '800' }],
         8)

      expect(holdings.get('PUMP')!.toFixed()).toBe('194074.79358912')
      expect(holdings.has('USDT')).toBe(false)
   })

   test('keeps a fee paid in a third coin as a negative holding', () => {
      const holdings = foldHoldings([{ asset: 'USDT', amount: '100' }, { asset: 'MNT', amount: '-0.25' }])

      expect(holdings.get('MNT')!.toFixed()).toBe('-0.25')
   })
})

const movement = (createdAt: number, kind: PositionMovement['kind'], asset: string, amount: string, value = '0', orderLinkId: string | null = null): PositionMovement =>
   ({ kind, asset, amount, value, orderLinkId, createdAt })

const order = (createdAt: number, orderLinkId: string, side: PositionOrder['side'], base: string, quote: string): PositionOrder =>
   ({ orderLinkId, side, baseAsset: 'BTC', base, quote, createdAt })

describe('folding positions', () => {

   test('realizes a sell against the average cost of every buy before it', () => {
      const { coins } = foldPositions('USDT',
         [movement(0, 'deposit', 'USDT', '2000', '2000'), movement(4, 'fee', 'USDT', '-0.7', '0', 'sell-1')],
         [order(1, 'buy-1', 'buy', '0.01', '500'), order(2, 'buy-2', 'buy', '0.01', '600'), order(3, 'sell-1', 'sell', '0.01', '700')])

      const btc = coins.get('BTC')!
      expect(btc.quantity.toFixed()).toBe('0.01')
      expect(btc.cost.toFixed()).toBe('550')
      expect(btc.realized.toFixed()).toBe('149.3')
   })

   test('folds a buy fee paid in the coin into its average cost', () => {
      const { coins } = foldPositions('USDT',
         [movement(2, 'fee', 'BTC', '-0.00001', '0', 'buy-1')],
         [order(1, 'buy-1', 'buy', '0.01', '500')])

      const btc = coins.get('BTC')!
      expect(btc.quantity.toFixed()).toBe('0.00999')
      expect(btc.cost.toFixed()).toBe('500')
      expect(btc.realized.toFixed()).toBe('0')
   })

   test('applies a fee with its order even when it was recorded after later events', () => {
      const { coins } = foldPositions('USDT',
         [movement(9, 'fee', 'BTC', '-0.01', '0', 'buy-1')],
         [order(1, 'buy-1', 'buy', '0.02', '1000'), order(2, 'sell-1', 'sell', '0.005', '300')])

      const btc = coins.get('BTC')!
      expect(btc.quantity.toFixed()).toBe('0.005')
      expect(btc.cost.toFixed()).toBe('500')
      expect(btc.realized.toFixed()).toBe('-200')
   })

   test('costs a deposited coin at its value on the day it came in', () => {
      const { coins } = foldPositions('USDT', [movement(1, 'deposit', 'BTC', '0.01', '400')],
         [order(2, 'sell-1', 'sell', '0.005', '300')])

      const btc = coins.get('BTC')!
      expect(btc.cost.toFixed()).toBe('200')
      expect(btc.realized.toFixed()).toBe('100')
   })

   test('counts an adjustment up as free coins and one down as lost cost', () => {
      const { coins } = foldPositions('USDT', [
         movement(1, 'deposit', 'BTC', '0.01', '400'),
         movement(2, 'adjust', 'BTC', '0.01', '500'),
         movement(3, 'adjust', 'BTC', '-0.005', '-250')
      ], [])

      const btc = coins.get('BTC')!
      expect(btc.quantity.toFixed()).toBe('0.015')
      expect(btc.cost.toFixed()).toBe('300')
      expect(btc.realized.toFixed()).toBe('-100')
   })

   test('keeps cash out of the coins and books its adjustments on their own', () => {
      const { coins, cashRealized } = foldPositions('USDT', [
         movement(1, 'deposit', 'USDT', '1000', '1000'),
         movement(2, 'adjust', 'USDT', '-30', '-30'),
         movement(3, 'withdraw', 'USDT', '-500', '500')
      ], [])

      expect(coins.size).toBe(0)
      expect(cashRealized.toFixed()).toBe('-30')
   })
})

describe('validating targets', () => {

   const tradable = new Set(['BTC', 'ETH'])

   test('accepts weights that add up to exactly 100', () => {
      expect(validateTargets([{ asset: 'btc', weight: '60.5' }, { asset: 'USDT', weight: '39.5' }], 'USDT', tradable))
         .toEqual([
            { asset: 'BTC', weight: '60.5', stopPrice: null },
            { asset: 'USDT', weight: '39.5', stopPrice: null }
         ])
   })

   test('keeps a stop price on a coin and refuses one on the cash coin', () => {
      expect(validateTargets([{ asset: 'BTC', weight: '100', stopPrice: '45000.50' }], 'USDT', tradable))
         .toEqual([{ asset: 'BTC', weight: '100', stopPrice: '45000.5' }])

      expect(() => validateTargets([{ asset: 'USDT', weight: '100', stopPrice: '1' }], 'USDT', tradable))
         .toThrow(TargetError)
   })

   test('refuses a stop price that is zero, negative or not a number', () => {
      for (const stopPrice of ['0', '-1', 'soon']) {
         expect(() => validateTargets([{ asset: 'BTC', weight: '100', stopPrice }], 'USDT', tradable))
            .toThrow(TargetError)
      }
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

describe('moving a stopped coin to cash', () => {

   const targets = [
      { asset: 'BTC', weight: '50', stopPrice: '45000' },
      { asset: 'ETH', weight: '30', stopPrice: null },
      { asset: 'USDT', weight: '20', stopPrice: null }
   ]

   test('adds the weight to an existing cash target', () => {
      expect(moveWeightToCash(targets, 'BTC', 'USDT')).toEqual([
         { asset: 'ETH', weight: '30', stopPrice: null },
         { asset: 'USDT', weight: '70', stopPrice: null }
      ])
   })

   test('creates a cash target when the portfolio had none', () => {
      const without = targets.filter(({ asset }) => asset !== 'USDT')
         .map(target => target.asset === 'ETH' ? { ...target, weight: '50' } : target)

      expect(moveWeightToCash(without, 'BTC', 'USDT')).toEqual([
         { asset: 'ETH', weight: '50', stopPrice: null },
         { asset: 'USDT', weight: '50', stopPrice: null }
      ])
   })

   test('leaves the targets alone when the coin is not one of them', () => {
      expect(moveWeightToCash(targets, 'SOL', 'USDT')).toBe(targets)
   })
})

describe('planning stop orders', () => {

   const btc = market('BTC', '50000')

   test('floors the trigger to the tick and the quantity to the lot step', () => {
      const { desired, skipped } = planStops([
         { asset: 'BTC', stopPrice: Big('45000.567'), holding: Big('0.1234567891'), market: btc }
      ])

      expect(skipped).toEqual([])
      expect(desired).toEqual([
         { asset: 'BTC', symbol: 'BTCUSDT', quantity: Big('0.123456'), triggerPrice: Big('45000.56') }
      ])
   })

   test('skips a stop with no market, a stop above the price and a holding below the minimum', () => {
      const { desired, skipped } = planStops([
         { asset: 'SOL', stopPrice: Big('100'), holding: Big('1'), market: undefined },
         { asset: 'BTC', stopPrice: Big('50000'), holding: Big('1'), market: btc },
         { asset: 'ETH', stopPrice: Big('2000'), holding: Big('0.0000001'), market: market('ETH', '2500') }
      ])

      expect(desired).toEqual([])
      expect(skipped).toEqual([
         { asset: 'SOL', reason: 'no-market' },
         { asset: 'BTC', reason: 'above-price' },
         { asset: 'ETH', reason: 'too-small' }
      ])
   })

   test('keeps a resting stop that already matches and replaces one that does not', () => {
      const desired = [
         { asset: 'BTC', symbol: 'BTCUSDT', quantity: Big('0.5'), triggerPrice: Big('45000') },
         { asset: 'ETH', symbol: 'ETHUSDT', quantity: Big('2'), triggerPrice: Big('2000') }
      ]
      const live = [
         { orderLinkId: 'keep', asset: 'BTC', symbol: 'BTCUSDT', quantity: Big('0.5'), triggerPrice: Big('45000') },
         { orderLinkId: 'resize', asset: 'ETH', symbol: 'ETHUSDT', quantity: Big('1'), triggerPrice: Big('2000') },
         { orderLinkId: 'gone', asset: 'SOL', symbol: 'SOLUSDT', quantity: Big('3'), triggerPrice: Big('100') }
      ]

      const actions = stopActions(desired, live)

      expect(actions.keep.map(({ orderLinkId }) => orderLinkId)).toEqual(['keep'])
      expect(actions.cancel.map(({ orderLinkId }) => orderLinkId)).toEqual(['resize', 'gone'])
      expect(actions.place.map(({ asset }) => asset)).toEqual(['ETH'])
   })
})
