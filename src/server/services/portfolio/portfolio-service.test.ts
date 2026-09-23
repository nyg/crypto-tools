import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import Big from 'big.js'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { HttpRequesterError } from '../../errors'
import type { PortfolioExchange } from './exchange'
import type PortfolioServiceType from './portfolio-service'
import type { Venue } from './venues'
import type {
   ExchangeAccount, OpenStopOrder, OrderLookup, OrderRequest, OrderSettlement, SpotMarket, SpotPrice,
   StopOrderRequest, TakerFee, WalletCoin
} from '../../../types/portfolio'

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crypto-tools-portfolio-'))

const prices: Record<string, SpotPrice> = {
   BTCUSDT: { last: '50000', bid: '50000', ask: '50000' },
   ETHUSDT: { last: '2500', bid: '2500', ask: '2500' }
}

const market = (base: string): SpotMarket => ({
   symbol: `${base}USDT`, base, quote: 'USDT', baseStep: '0.000001', quoteStep: '0.01',
   tickStep: '0.01', minQty: '0.000001', minAmount: '5', maxQty: '1000', maxAmount: '10000000'
})

interface FakeStop {
   symbol: string
   quantity: string
   triggerPrice: string
   orderId: string
}

class FakeExchange implements PortfolioExchange {

   readonly balanceDecimals = 8
   buyFeeInQuote = false
   feeRate = '0.001'
   reportsFees = true
   readonly balances = new Map<string, Big>([['USDT', Big(10000)], ['BTC', Big('0.5')]])
   readonly settlements = new Map<string, OrderSettlement>()
   readonly stops = new Map<string, FakeStop>()
   rejectNext = false
   rejectStopNext = false
   stopsLock = false
   accountId = 'uid-1'

   async account(): Promise<ExchangeAccount> {
      return { accountId: this.accountId, canTrade: true, expiresAt: null }
   }

   async wallet(): Promise<WalletCoin[]> {
      return [...this.balances].map(([asset, total]) => {
         const locked = this.stopsLock ? this.#lockedBy(asset) : Big(0)
         return { asset, total: total.toFixed(), free: total.minus(locked).toFixed(), borrowed: '0' }
      })
   }

   #lockedBy(asset: string): Big {
      return [...this.stops.values()]
         .filter(({ symbol }) => symbol === `${asset}USDT`)
         .reduce((sum, { quantity }) => sum.plus(quantity), Big(0))
   }

   async markets(): Promise<SpotMarket[]> {
      return [market('BTC'), market('ETH')]
   }

   async prices(): Promise<Record<string, SpotPrice>> {
      return prices
   }

   async takerFees(symbols: string[]): Promise<Record<string, TakerFee>> {
      if (!this.reportsFees) return {}
      return Object.fromEntries(symbols.map(symbol => [symbol, { buy: this.feeRate, sell: this.feeRate }]))
   }

   async placeOrder({ clientOrderId, symbol, side, unit, amount }: OrderRequest): Promise<string> {
      if (this.rejectNext) {
         this.rejectNext = false
         throw new HttpRequesterError(200, { retCode: 170131, retMsg: 'Insufficient balance.' })
      }

      const base = symbol.replace(/USDT$/, '')
      const price = Big(prices[symbol]!.last)
      const quantity = unit === 'base' ? Big(amount) : Big(amount).div(price).round(6, Big.roundDown)

      const free = (this.balances.get(base) ?? Big(0)).minus(this.stopsLock ? this.#lockedBy(base) : 0)
      if (side === 'sell' && quantity.gt(free)) {
         throw new HttpRequesterError(200, { retCode: 170131, retMsg: 'Insufficient balance.' })
      }
      const value = quantity.times(price)
      const feeInBase = side === 'buy' && !this.buyFeeInQuote
      const fee = feeInBase ? quantity.times(this.feeRate) : value.times(this.feeRate)
      const sign = side === 'buy' ? 1 : -1

      this.#move(base, quantity.times(sign).minus(feeInBase ? fee : 0))
      this.#move('USDT', value.times(-sign).minus(feeInBase ? 0 : fee))

      this.settlements.set(clientOrderId, {
         orderId: `order-${this.settlements.size + 1}`, status: 'filled',
         base: quantity.toFixed(), quote: value.toFixed(), averagePrice: price.toFixed(),
         fees: { [feeInBase ? base : 'USDT']: fee.toFixed() }, reason: ''
      })
      return `order-${this.settlements.size}`
   }

   async settleOrder({ clientOrderId }: OrderLookup): Promise<OrderSettlement | null> {
      return this.settlements.get(clientOrderId) ?? null
   }

   async placeStopOrder({ clientOrderId, symbol, quantity, triggerPrice }: StopOrderRequest): Promise<string> {
      if (this.rejectStopNext) {
         this.rejectStopNext = false
         throw new HttpRequesterError(200, { retCode: 170131, retMsg: 'Insufficient balance.' })
      }
      const orderId = `stop-${this.stops.size + 1}`
      this.stops.set(clientOrderId, { symbol, quantity, triggerPrice, orderId })
      return orderId
   }

   async cancelStopOrder({ clientOrderId }: OrderLookup): Promise<void> {
      this.stops.delete(clientOrderId)
   }

   async openStopOrders(): Promise<OpenStopOrder[]> {
      return [...this.stops].map(([clientOrderId, { orderId, symbol, quantity, triggerPrice }]) =>
         ({ clientOrderId, orderId, symbol, quantity, triggerPrice }))
   }

   describeError(error: HttpRequesterError): string {
      const body = error.body as { retCode?: number, retMsg?: string }
      return `${body.retMsg} (${body.retCode})`
   }

   isAmbiguous(): boolean {
      return false
   }

   triggerStop(clientOrderId: string): void {
      const stop = this.stops.get(clientOrderId)!
      this.stops.delete(clientOrderId)

      const base = stop.symbol.replace(/USDT$/, '')
      const price = Big(stop.triggerPrice)
      const quantity = Big(stop.quantity)
      const value = quantity.times(price)
      const fee = value.times(this.feeRate)

      this.#move(base, quantity.times(-1))
      this.#move('USDT', value.minus(fee))

      this.settlements.set(clientOrderId, {
         orderId: stop.orderId, status: 'filled', base: quantity.toFixed(), quote: value.toFixed(),
         averagePrice: price.toFixed(), fees: { USDT: fee.toFixed() }, reason: ''
      })
   }

   refuseStop(clientOrderId: string): void {
      const stop = this.stops.get(clientOrderId)!
      this.stops.delete(clientOrderId)
      this.settlements.set(clientOrderId, {
         orderId: stop.orderId, status: 'rejected', base: '0', quote: '0', averagePrice: '0',
         fees: {}, reason: 'Insufficient balance.'
      })
   }

   loseStop(clientOrderId: string): void {
      this.stops.delete(clientOrderId)
   }

   #move(asset: string, amount: Big) {
      this.balances.set(asset, (this.balances.get(asset) ?? Big(0)).plus(amount))
   }
}

let PortfolioService: typeof PortfolioServiceType
let PortfolioError: typeof import('./portfolio-service').PortfolioError
let PortfolioRepository: typeof import('../../db/portfolio-repository').default

const exchange = new FakeExchange()
const venue: Venue = {
   id: 'bybitDemo', provider: 'bybitDemo', label: 'Fake', quoteAssets: ['USDT', 'USDC'], valuationAsset: 'USDT',
   hardStops: true, stopsReserve: false, exchange: () => exchange
}

const service = () => new PortfolioService(venue, exchange)

async function finished(runId: string, portfolios = service()) {
   for (let attempt = 0; attempt < 100; attempt++) {
      const { run } = await portfolios.run({ runId })
      if (!run.running) return run
      await new Promise(resolve => setTimeout(resolve, 100))
   }
   throw new Error('The run never finished.')
}

async function statusOf(promise: Promise<unknown>): Promise<number | null> {
   try {
      await promise
      return null
   }
   catch (error) {
      return error instanceof PortfolioError ? error.status : -1
   }
}

beforeAll(async () => {
   process.env.CRYPTO_TOOLS_DATA_DIR = dataDir
   const module = await import('./portfolio-service')
   PortfolioService = module.default
   PortfolioError = module.PortfolioError
   PortfolioRepository = (await import('../../db/portfolio-repository')).default
})

afterAll(async () => {
   const { closeDatabase } = await import('../../db/database')
   closeDatabase()
   fs.rmSync(dataDir, { recursive: true, force: true })
})

describe('a portfolio from creation to withdrawal', () => {

   let portfolioId: number

   test('is created with its targets', async () => {
      const { id } = await service().save({
         name: 'Core', quoteAsset: 'USDT', band: '1',
         targets: [{ asset: 'BTC', weight: '50' }, { asset: 'ETH', weight: '30' }, { asset: 'USDT', weight: '20' }]
      })
      portfolioId = id

      const overview = await service().overview()
      expect(overview.portfolios.map(({ name }) => name)).toEqual(['Core'])
   })

   test('refuses a deposit of a coin that is neither a target nor the quote asset', async () => {
      await expect(service().deposit({ portfolioId, asset: 'SOL', amount: '1' }))
         .rejects.toThrow('SOL is not one of Core\'s targets.')
   })

   test('refuses a deposit larger than what is unallocated', async () => {
      expect(await statusOf(service().deposit({ portfolioId, asset: 'USDT', amount: '20000' }))).toBe(400)
   })

   test('takes a cash deposit and shows it as allocated', async () => {
      await service().deposit({ portfolioId, asset: 'USDT', amount: '1000' })

      const overview = await service().overview()
      const usdt = overview.coins.find(({ asset }) => asset === 'USDT')!
      expect(usdt.allocated).toBe('1000')
      expect(usdt.unallocated).toBe('9000')
      expect(overview.portfolios[0]!.needsRebalance).toBe(true)
      expect(overview.portfolios[0]!.lastRebalancedAt).toBeNull()
   })

   test('rebalances into the targets through market orders', async () => {
      const plan = await service().plan({ portfolioId, kind: 'rebalance' })
      expect(plan.orders.map(({ side, asset, amount }) => `${side} ${asset} ${amount}`))
         .toEqual(['buy BTC 500', 'buy ETH 300'])
      expect(plan.orders[0]).toMatchObject({ fee: { asset: 'BTC', amount: '0.00001' }, feeRate: '0.001', feeRateAssumed: false })

      const { run } = await service().execute({ planId: plan.planId })
      const done = await finished(run.id)

      expect(done.status).toBe('done')
      expect(done.orders.every(({ status }) => status === 'filled')).toBe(true)
      expect(done.orders[0]!.fees).toEqual([{ asset: 'BTC', amount: '0.00001' }])

      const overview = await service().overview()
      const btc = overview.portfolios[0]!.holdings.find(({ asset }) => asset === 'BTC')!
      expect(btc.quantity).toBe('0.00999')
      expect(overview.portfolios[0]!.needsRebalance).toBe(false)
      expect(overview.portfolios[0]!.lastRebalancedAt).toBe(done.finishedAt)
   })

   test('counts the buy fees as unrealized loss while prices stand still', async () => {
      const portfolio = (await service().overview()).portfolios[0]!
      const btc = portfolio.holdings.find(({ asset }) => asset === 'BTC')!

      expect(btc.unrealized).toBe('-0.5')
      expect(btc.unrealizedPercent).toBe('-0.1')
      expect(portfolio.unrealized).toBe('-0.8')
      expect(portfolio.unrealizedPercent).toBe('-0.1')
      expect(portfolio.realized).toBe('0')
      expect(portfolio.profit).toBe('-0.8')
   })

   test('will not run the same preview twice', async () => {
      const plan = await service().plan({ portfolioId, kind: 'rebalance', band: '0' })
      await finished((await service().execute({ planId: plan.planId })).run.id)

      expect(await statusOf(service().execute({ planId: plan.planId }))).toBe(410)
   })

   test('refuses a preview the portfolio has moved on from', async () => {
      const plan = await service().plan({ portfolioId, kind: 'rebalance' })
      await service().deposit({ portfolioId, asset: 'USDT', amount: '10' })

      expect(await statusOf(service().execute({ planId: plan.planId }))).toBe(409)
   })

   test('withdraws from cash without trading when the cash covers it', async () => {
      const plan = await service().plan({ portfolioId, kind: 'withdraw', amount: '100' })
      expect(plan.orders).toHaveLength(0)

      const run = await finished((await service().execute({ planId: plan.planId })).run.id)
      expect(run.status).toBe('done')
      expect(run.withdrawn).toBe('100')

      const { movements } = await service().history({ portfolioId })
      expect(movements[0]).toMatchObject({ kind: 'withdraw', asset: 'USDT', amount: '-100' })
   })

   test('records a refused order and finishes the run as partial', async () => {
      const rebalancedAt = (await service().overview()).portfolios[0]!.lastRebalancedAt
      const plan = await service().plan({ portfolioId, kind: 'withdraw', amount: '500' })
      expect(plan.orders.length).toBeGreaterThan(0)

      exchange.rejectNext = true
      const run = await finished((await service().execute({ planId: plan.planId })).run.id)

      expect(run.orders[0]!.status).toBe('rejected')
      expect(run.orders[0]!.error).toContain('Insufficient balance')
      expect(run.status).toBe('partial')
      expect((await service().overview()).portfolios[0]!.lastRebalancedAt).toBe(rebalancedAt)
   })

   test('releases its holdings to unallocated when archived', async () => {
      await service().archive({ portfolioId })

      const overview = await service().overview()
      expect(overview.portfolios).toHaveLength(0)
      expect(overview.coins.every(({ allocated }) => allocated === '0')).toBe(true)
   })
})

describe('a withdrawal that fills below the preview price', () => {

   test('still counts as done while the shortfall is within the slippage allowed', async () => {
      const { id: portfolioId } = await service().save({
         name: 'Slipping', quoteAsset: 'USDT', band: '1', targets: [{ asset: 'BTC', weight: '100' }]
      })
      await service().deposit({ portfolioId, asset: 'BTC', amount: '0.01' })
      const plan = await service().plan({ portfolioId, kind: 'withdraw', amount: '100' })

      prices.BTCUSDT = { ...prices.BTCUSDT!, last: '49750' }
      try {
         const run = await finished((await service().execute({ planId: plan.planId })).run.id)
         expect(Number(run.withdrawn)).toBeLessThan(100)
         expect(run.status).toBe('done')
      }
      finally {
         prices.BTCUSDT = { ...prices.BTCUSDT!, last: '50000' }
      }

      await service().archive({ portfolioId })
   })
})

describe('a venue that takes the buy fee from the cash', () => {

   test('invests all the cash without spending more than the portfolio holds', async () => {
      const cashFees = new FakeExchange()
      cashFees.accountId = 'cash-fees'
      cashFees.buyFeeInQuote = true
      cashFees.feeRate = '0.0025'
      const portfolios = new PortfolioService(venue, cashFees)

      const { id: portfolioId } = await portfolios.save({
         name: 'All in', quoteAsset: 'USDT', band: '2',
         targets: [{ asset: 'BTC', weight: '50' }, { asset: 'ETH', weight: '50' }]
      })
      await portfolios.deposit({ portfolioId, asset: 'USDT', amount: '300' })

      const plan = await portfolios.plan({ portfolioId, kind: 'rebalance' })
      expect(plan.orders.map(({ side, asset, amount }) => `${side} ${asset} ${amount}`))
         .toEqual(['buy BTC 149.62', 'buy ETH 149.62'])
      expect(plan.orders[0]).toMatchObject({ fee: { asset: 'USDT', amount: '0.37405' }, feeRate: '0.0025' })
      expect(plan.shortfall).toBe('0')

      const run = await finished((await portfolios.execute({ planId: plan.planId })).run.id, portfolios)
      expect(run.status).toBe('done')

      const portfolio = (await portfolios.overview()).portfolios.find(({ id }) => id === portfolioId)!
      const cash = portfolio.holdings.find(({ asset }) => asset === 'USDT')!
      expect(cash.quantity).toBe('0.03195')
   })
})

describe('an exchange that reports no fee rate', () => {

   test('previews the orders at the standard taker rate and says it assumed it', async () => {
      const silent = new FakeExchange()
      silent.accountId = 'silent-fees'
      silent.reportsFees = false
      const portfolios = new PortfolioService(venue, silent)

      const { id: portfolioId } = await portfolios.save({
         name: 'Assumed', quoteAsset: 'USDT', band: '2', targets: [{ asset: 'BTC', weight: '100' }]
      })
      await portfolios.deposit({ portfolioId, asset: 'USDT', amount: '100' })

      const plan = await portfolios.plan({ portfolioId, kind: 'rebalance' })
      expect(plan.orders[0]).toMatchObject({ fee: { asset: 'BTC', amount: '0.000002' }, feeRate: '0.001', feeRateAssumed: true })
   })
})

describe('profit split into realized and unrealized', () => {

   test('adds up to the profit after a sell at a higher price', async () => {
      const { id: portfolioId } = await service().save({
         name: 'Split', quoteAsset: 'USDT', band: '1', targets: [{ asset: 'BTC', weight: '100' }]
      })
      await service().deposit({ portfolioId, asset: 'BTC', amount: '0.01' })

      const before = prices.BTCUSDT!
      prices.BTCUSDT = { last: '60000', bid: '60000', ask: '60000' }
      try {
         const plan = await service().plan({ portfolioId, kind: 'withdraw', amount: '120' })
         await finished((await service().execute({ planId: plan.planId })).run.id)

         const portfolio = (await service().overview()).portfolios.find(({ id }) => id === portfolioId)!
         const btc = portfolio.holdings.find(({ asset }) => asset === 'BTC')!

         expect(Big(btc.unrealized!).eq(Big(btc.quantity).times(10000))).toBe(true)
         expect(Big(btc.realized).gt(0)).toBe(true)
         expect(portfolio.closedRealized).toBe('0')
         expect(Big(portfolio.realized).plus(portfolio.unrealized).eq(portfolio.profit)).toBe(true)
      }
      finally {
         prices.BTCUSDT = before
      }

      await service().archive({ portfolioId })
   })
})

describe('stop orders', () => {

   let portfolioId: number

   const stopOf = (portfolio: { stops: { asset: string, status: string, orderLinkId: string, quantity: string, triggerPrice: string }[] }, asset: string) =>
      portfolio.stops.find(stop => stop.asset === asset)

   const portfolioOf = async (id: number) =>
      (await service().overview()).portfolios.find(portfolio => portfolio.id === id)!

   const flooredToLot = (quantity: string) => Big(quantity).round(6, Big.roundDown).toFixed()

   test('arms a stop sized to the holding once the portfolio owns the coin', async () => {
      const { id } = await service().save({
         name: 'Stopped', quoteAsset: 'USDT', band: '1',
         targets: [
            { asset: 'BTC', weight: '50', stopPrice: '45000.004' },
            { asset: 'USDT', weight: '50' }
         ]
      })
      portfolioId = id

      await service().deposit({ portfolioId, asset: 'USDT', amount: '1000' })
      const plan = await service().plan({ portfolioId, kind: 'rebalance' })
      await finished((await service().execute({ planId: plan.planId })).run.id)

      const { stops } = await service().syncStops({ portfolioId })
      const holding = (await portfolioOf(portfolioId)).holdings.find(({ asset }) => asset === 'BTC')!

      expect(stops).toHaveLength(1)
      expect(stops[0]!.asset).toBe('BTC')
      expect(stops[0]!.quantity).toBe(flooredToLot(holding.quantity))
      expect(stops[0]!.triggerPrice).toBe('45000')
      expect(exchange.stops.has(stops[0]!.orderLinkId)).toBe(true)
   })

   test('refuses a stop price at or above the current price', async () => {
      const { id } = await service().save({
         id: portfolioId, name: 'Stopped', quoteAsset: 'USDT', band: '1',
         targets: [
            { asset: 'BTC', weight: '50', stopPrice: '60000' },
            { asset: 'USDT', weight: '50' }
         ]
      })

      const { stops, skipped } = await service().syncStops({ portfolioId: id })

      expect(stops).toHaveLength(0)
      expect(skipped).toEqual([{ asset: 'BTC', reason: 'above-price' }])
      expect(exchange.stops.size).toBe(0)
   })

   test('cancels the stop before a run and places it again afterwards', async () => {
      await service().save({
         id: portfolioId, name: 'Stopped', quoteAsset: 'USDT', band: '1',
         targets: [
            { asset: 'BTC', weight: '50', stopPrice: '45000' },
            { asset: 'USDT', weight: '50' }
         ]
      })
      await service().syncStops({ portfolioId })
      const armed = stopOf(await portfolioOf(portfolioId), 'BTC')!

      await service().deposit({ portfolioId, asset: 'USDT', amount: '500' })
      const plan = await service().plan({ portfolioId, kind: 'rebalance', band: '0' })
      const done = await finished((await service().execute({ planId: plan.planId })).run.id)
      expect(done.status).toBe('done')

      const portfolio = await portfolioOf(portfolioId)
      const replaced = stopOf(portfolio, 'BTC')!
      const holding = portfolio.holdings.find(({ asset }) => asset === 'BTC')!

      expect(exchange.stops.has(armed.orderLinkId)).toBe(false)
      expect(replaced.orderLinkId).not.toBe(armed.orderLinkId)
      expect(replaced.quantity).toBe(flooredToLot(holding.quantity))
      expect(exchange.stops.get(replaced.orderLinkId)!.quantity).toBe(flooredToLot(holding.quantity))
   })

   test('places the stop again after a deposit changes the holding', async () => {
      const before = stopOf(await portfolioOf(portfolioId), 'BTC')!

      await service().deposit({ portfolioId, asset: 'BTC', amount: '0.01' })
      await service().syncStops({ portfolioId })

      const portfolio = await portfolioOf(portfolioId)
      const after = stopOf(portfolio, 'BTC')!
      const holding = portfolio.holdings.find(({ asset }) => asset === 'BTC')!

      expect(after.orderLinkId).not.toBe(before.orderLinkId)
      expect(after.quantity).toBe(flooredToLot(holding.quantity))
   })

   test('records a fill, drops the coin from the targets and moves its weight to cash', async () => {
      const armed = stopOf(await portfolioOf(portfolioId), 'BTC')!
      exchange.triggerStop(armed.orderLinkId)

      const overview = await service().overview()
      const portfolio = overview.portfolios.find(({ id }) => id === portfolioId)!

      expect(portfolio.targets).toEqual([{ asset: 'USDT', weight: '100', stopPrice: null }])

      const dust = portfolio.holdings.find(({ asset }) => asset === 'BTC')?.quantity ?? '0'
      expect(Big(dust).lt('0.000001')).toBe(true)
      expect(portfolio.stops).toHaveLength(0)

      const fill = overview.stopFills.find(entry => entry.orderLinkId === armed.orderLinkId)!
      expect(fill.asset).toBe('BTC')
      expect(fill.quantity).toBe(armed.quantity)
      expect(Number(fill.proceeds)).toBeGreaterThan(0)

      const { runs } = await service().history({ portfolioId })
      const stopRun = runs.find(run => run.kind === 'stop')!
      expect(stopRun.orders[0]!.status).toBe('filled')
      expect(stopRun.orders[0]!.side).toBe('sell')
   })

   test('does not record the same fill twice and clears it once acknowledged', async () => {
      const first = await service().overview()
      const fill = first.stopFills[0]!

      const again = await service().overview()
      expect(again.stopFills.map(({ orderLinkId }) => orderLinkId)).toEqual([fill.orderLinkId])

      const { runs } = await service().history({ portfolioId })
      expect(runs.filter(run => run.kind === 'stop')).toHaveLength(1)

      expect(await service().ackStop({ orderLinkId: fill.orderLinkId })).toEqual({ acknowledged: 1 })
      expect((await service().overview()).stopFills).toHaveLength(0)
   })

   test('records a refused stop as failed and leaves the targets alone', async () => {
      await service().save({
         id: portfolioId, name: 'Stopped', quoteAsset: 'USDT', band: '1',
         targets: [
            { asset: 'BTC', weight: '50', stopPrice: '45000' },
            { asset: 'USDT', weight: '50' }
         ]
      })
      await service().deposit({ portfolioId, asset: 'BTC', amount: '0.01' })
      const { stops } = await service().syncStops({ portfolioId })
      exchange.refuseStop(stops[0]!.orderLinkId)

      const overview = await service().overview()
      const portfolio = overview.portfolios.find(({ id }) => id === portfolioId)!

      expect(stopOf(portfolio, 'BTC')!.status).toBe('failed')
      expect(portfolio.targets.map(({ asset }) => asset)).toEqual(['BTC', 'USDT'])
      expect(overview.stopsSyncing).toBe(false)
   })

   test('places a stop again when the exchange no longer holds it', async () => {
      const { stops } = await service().syncStops({ portfolioId })
      const armed = stops.find(({ asset }) => asset === 'BTC')!
      exchange.loseStop(armed.orderLinkId)

      const overview = await service().overview()
      expect(overview.stopFills).toHaveLength(0)
      expect(overview.stopsSyncing).toBe(true)

      const replaced = (await service().syncStops({ portfolioId })).stops.find(({ asset }) => asset === 'BTC')!
      expect(replaced.orderLinkId).not.toBe(armed.orderLinkId)
      expect(exchange.stops.has(replaced.orderLinkId)).toBe(true)

      await service().archive({ portfolioId })
   })

   test('sells a coin its own stop has locked on a venue whose stops reserve the balance', async () => {
      const reserving = new PortfolioService({ ...venue, stopsReserve: true }, exchange)
      exchange.stopsLock = true
      try {
         const { id } = await reserving.save({
            name: 'Locked', quoteAsset: 'USDT', band: '1',
            targets: [
               { asset: 'BTC', weight: '50', stopPrice: '45000' },
               { asset: 'USDT', weight: '50' }
            ]
         })
         const btc = (await reserving.overview()).coins.find(({ asset }) => asset === 'BTC')!
         const everything = Big(btc.free).lt(btc.unallocated) ? btc.free : btc.unallocated
         await reserving.deposit({ portfolioId: id, asset: 'BTC', amount: everything })
         const { stops } = await reserving.syncStops({ portfolioId: id })
         expect(stops).toHaveLength(1)

         const plan = await reserving.plan({ portfolioId: id, kind: 'rebalance' })
         expect(plan.orders.map(({ side, asset }) => `${side} ${asset}`)).toEqual(['sell BTC'])
         expect(plan.skipped).toEqual([])

         const run = await finished((await reserving.execute({ planId: plan.planId })).run.id)
         expect(run.orders[0]!.status).toBe('filled')
         expect(exchange.stops.has(stops[0]!.orderLinkId)).toBe(false)

         await reserving.archive({ portfolioId: id })
      }
      finally {
         exchange.stopsLock = false
      }
   })

   test('keeps the stop price but places nothing on a venue without stop orders', async () => {
      const quiet = new PortfolioService({ ...venue, hardStops: false }, exchange)
      const { id } = await quiet.save({
         name: 'No stops', quoteAsset: 'USDT', band: '1',
         targets: [
            { asset: 'BTC', weight: '50', stopPrice: '45000' },
            { asset: 'USDT', weight: '50' }
         ]
      })

      await quiet.deposit({ portfolioId: id, asset: 'BTC', amount: '0.01' })
      const overview = await quiet.overview()
      const portfolio = overview.portfolios.find(entry => entry.id === id)!

      expect(overview.hardStops).toBe(false)
      expect(overview.stopsSyncing).toBe(false)
      expect(portfolio.stops).toHaveLength(0)
      expect(portfolio.targets.find(({ asset }) => asset === 'BTC')!.stopPrice).toBe('45000')
      expect(await statusOf(quiet.syncStops({ portfolioId: id }))).toBe(400)

      await quiet.archive({ portfolioId: id })
   })
})

describe('reconciliation', () => {

   test('marks a run the server no longer tracks as interrupted', async () => {
      const { id: portfolioId } = await service().save({
         name: 'Interrupted', quoteAsset: 'USDT', band: '1', targets: [{ asset: 'BTC', weight: '100' }]
      })

      const repository = new PortfolioRepository('bybitDemo', exchange.accountId)
      repository.createRun({
         id: 'orphan-run', portfolioId, kind: 'rebalance', status: 'running',
         withdraw: '0', reserve: '0', slippage: '1', startedAt: Date.now()
      }, [{
         orderLinkId: 'pf-orphan-1', seq: 1, symbol: 'BTCUSDT', side: 'buy',
         baseAsset: 'BTC', quoteAsset: 'USDT', unit: 'quote', requested: '100'
      }])

      const overview = await service().overview()
      expect(overview.reconciled).toBe(2)

      const { run } = await service().run({ runId: 'orphan-run' })
      expect(run.status).toBe('interrupted')
      expect(run.orders[0]!.status).toBe('skipped')
   })

   test('keeps another account out of the portfolios', async () => {
      exchange.accountId = 'uid-2'
      const overview = await service().overview()
      exchange.accountId = 'uid-1'

      expect(overview.portfolios).toHaveLength(0)
   })
})
