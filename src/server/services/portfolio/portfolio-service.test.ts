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
   CandleInterval, ExchangeAccount, LimitOrderRequest, OpenStopOrder, OrderLookup, OrderRequest, OrderSettlement,
   OrderSide, SpotCandle, SpotMarket, SpotPrice, StopOrderRequest, TradeFees, WalletCoin
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

interface FakeLimit {
   clientOrderId: string
   symbol: string
   side: OrderSide
   quantity: Big
   price: Big
   filled: Big
   orderId: string
}

const POST_ONLY_REFUSED = 170218

class FakeExchange implements PortfolioExchange {

   readonly balanceDecimals = 8
   chasePacing = { pollMs: 20, moveAfterMs: 0, pollsTakeTurns: false }
   buyFeeInQuote = false
   feeRate = '0.001'
   makerFeeRate = '0.0004'
   reportsFees = true
   feeAsset: string | null = null
   readonly balances = new Map<string, Big>([['USDT', Big(10000)], ['BTC', Big('0.5')]])
   readonly settlements = new Map<string, OrderSettlement>()
   readonly stops = new Map<string, FakeStop>()
   readonly candleSeries = new Map<string, SpotCandle[]>()
   readonly limits = new Map<string, FakeLimit>()
   readonly placedLimits: FakeLimit[] = []
   readonly marketCalls: string[] = []
   fillsLimits = true
   refusesLimits = 0
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

   async candles(symbol: string, interval: CandleInterval): Promise<SpotCandle[]> {
      const series = this.candleSeries.get(`${symbol}:${interval}`)
      if (!series) throw new HttpRequesterError(200, { retCode: 10001, retMsg: 'Not supported symbols.' })
      return series
   }

   async tradeFees(symbols: string[]): Promise<Record<string, TradeFees>> {
      if (!this.reportsFees) return {}
      return Object.fromEntries(symbols.map(symbol => [symbol, {
         taker: { buy: this.feeRate, sell: this.feeRate },
         maker: { buy: this.makerFeeRate, sell: this.makerFeeRate }
      }]))
   }

   async placeLimitOrder({ clientOrderId, symbol, side, quantity, price }: LimitOrderRequest): Promise<string> {
      const book = prices[symbol]!
      const wouldTake = side === 'buy' ? Big(price).gte(book.ask) : Big(price).lte(book.bid)

      if (this.refusesLimits > 0 || wouldTake) {
         this.refusesLimits = Math.max(0, this.refusesLimits - 1)
         throw new HttpRequesterError(200, { retCode: POST_ONLY_REFUSED, retMsg: 'The LIMIT-MAKER order is rejected due to invalid price.' })
      }

      const limit = {
         clientOrderId, symbol, side, quantity: Big(quantity), price: Big(price), filled: Big(0),
         orderId: `limit-${this.placedLimits.length + 1}`
      }
      this.limits.set(clientOrderId, limit)
      this.placedLimits.push(limit)
      this.#settleLimit(limit, 'open')
      return limit.orderId
   }

   async cancelOrder({ clientOrderId }: OrderLookup): Promise<void> {
      const limit = this.limits.get(clientOrderId)
      if (!limit) return
      this.limits.delete(clientOrderId)
      this.#settleLimit(limit, limit.filled.gt(0) ? 'partial' : 'rejected')
   }

   fillLimit(clientOrderId: string, quantity?: string): void {
      const limit = this.limits.get(clientOrderId)!
      const filled = Big(quantity ?? limit.quantity.minus(limit.filled))
      const value = filled.times(limit.price)
      const base = limit.symbol.replace(/USDT$/, '')
      const sign = limit.side === 'buy' ? 1 : -1

      limit.filled = limit.filled.plus(filled)
      this.#move(base, filled.times(sign))
      this.#move('USDT', value.times(-sign))

      const done = limit.filled.eq(limit.quantity)
      if (done) this.limits.delete(clientOrderId)
      this.#settleLimit(limit, done ? 'filled' : 'open')
   }

   #settleLimit(limit: FakeLimit, status: OrderSettlement['status']): void {
      const base = limit.symbol.replace(/USDT$/, '')
      const value = limit.filled.times(limit.price)
      const feeInBase = limit.side === 'buy' && !this.buyFeeInQuote
      const fee = (feeInBase ? limit.filled : value).times(this.makerFeeRate)

      this.settlements.set(limit.clientOrderId, {
         orderId: limit.orderId, status,
         base: limit.filled.toFixed(), quote: value.toFixed(), averagePrice: limit.price.toFixed(),
         fees: status === 'open' || fee.eq(0) ? {} : { [feeInBase ? base : 'USDT']: fee.toFixed() },
         reason: status === 'filled' || status === 'open' ? '' : 'Cancelled'
      })
   }

   async placeOrder({ clientOrderId, symbol, side, unit, amount }: OrderRequest): Promise<string> {
      this.marketCalls.push(`place ${symbol}`)
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
      const feeAsset = this.feeAsset ?? (feeInBase ? base : 'USDT')
      const fee = this.feeAsset ? value.times(this.feeRate).div(prices[`${this.feeAsset}USDT`]!.last)
         : feeInBase ? quantity.times(this.feeRate) : value.times(this.feeRate)
      const sign = side === 'buy' ? 1 : -1

      this.#move(base, quantity.times(sign))
      this.#move('USDT', value.times(-sign))
      this.#move(feeAsset, fee.times(-1))

      this.settlements.set(clientOrderId, {
         orderId: `order-${this.settlements.size + 1}`, status: 'filled',
         base: quantity.toFixed(), quote: value.toFixed(), averagePrice: price.toFixed(),
         fees: { [feeAsset]: fee.toFixed() }, reason: ''
      })
      return `order-${this.settlements.size}`
   }

   async settleOrder({ symbol, clientOrderId }: OrderLookup): Promise<OrderSettlement | null> {
      this.marketCalls.push(`check ${symbol}`)
      if (this.fillsLimits && this.limits.has(clientOrderId)) this.fillLimit(clientOrderId)
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

   isPostOnlyRefusal(error: HttpRequesterError): boolean {
      return (error.body as { retCode?: number }).retCode === POST_ONLY_REFUSED
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

async function until(condition: () => boolean) {
   for (let attempt = 0; attempt < 300; attempt++) {
      if (condition()) return
      await new Promise(resolve => setTimeout(resolve, 10))
   }
   throw new Error('The condition never held.')
}

const quoted = (price: string): SpotPrice => ({ last: price, bid: price, ask: price })

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

   test('previews a rebalance that only sells, or leaves a coin out, without placing anything', async () => {
      const trim = await service().plan({ execution: 'market', portfolioId, kind: 'rebalance', mode: 'trim' })
      expect(trim.mode).toBe('trim')
      expect(trim.orders).toHaveLength(0)
      expect(trim.skipped.map(({ asset, reason }) => `${asset} ${reason}`)).toEqual(['BTC no-buys', 'ETH no-buys'])

      const withoutEth = await service().plan({ execution: 'market', portfolioId, kind: 'rebalance', exclude: ['eth'] })
      expect(withoutEth.orders.map(({ side, asset, amount }) => `${side} ${asset} ${amount}`)).toEqual(['buy BTC 500'])
      expect(withoutEth.skipped).toContainEqual({ asset: 'ETH', reason: 'excluded', value: '300' })
   })

   test('refuses a way to rebalance it does not know', async () => {
      expect(await statusOf(service().plan({ execution: 'market', portfolioId, kind: 'rebalance', mode: 'sideways' }))).toBe(400)
   })

   test('rebalances into the targets through market orders', async () => {
      const plan = await service().plan({ execution: 'market', portfolioId, kind: 'rebalance' })
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

   test('counts the buy fees as a realized loss, and nothing unrealized while prices stand still', async () => {
      const portfolio = (await service().overview()).portfolios[0]!
      const btc = portfolio.holdings.find(({ asset }) => asset === 'BTC')!

      expect(btc.unrealized).toBe('0')
      expect(btc.realized).toBe('-0.5')
      expect(portfolio.unrealized).toBe('0')
      expect(portfolio.realized).toBe('-0.8')
      expect(portfolio.realizedPercent).toBeNull()
      expect(btc.realizedPercent).toBeNull()
      expect(portfolio.closedRealizedPercent).toBeNull()
      expect(portfolio.profit).toBe('-0.8')
      expect(portfolio.fees).toBe('0.8')
      expect(portfolio.feesUnvalued).toEqual([])
   })

   test('will not run the same preview twice', async () => {
      const plan = await service().plan({ execution: 'market', portfolioId, kind: 'rebalance', band: '0' })
      await finished((await service().execute({ planId: plan.planId })).run.id)

      expect(await statusOf(service().execute({ planId: plan.planId }))).toBe(410)
   })

   test('refuses a preview the portfolio has moved on from', async () => {
      const plan = await service().plan({ execution: 'market', portfolioId, kind: 'rebalance' })
      await service().deposit({ portfolioId, asset: 'USDT', amount: '10' })

      expect(await statusOf(service().execute({ planId: plan.planId }))).toBe(409)
   })

   test('withdraws from cash without trading when the cash covers it', async () => {
      const plan = await service().plan({ execution: 'market', portfolioId, kind: 'withdraw', amount: '100' })
      expect(plan.orders).toHaveLength(0)

      const run = await finished((await service().execute({ planId: plan.planId })).run.id)
      expect(run.status).toBe('done')
      expect(run.withdrawn).toBe('100')

      const { movements } = await service().history({ portfolioId })
      expect(movements[0]).toMatchObject({ kind: 'withdraw', asset: 'USDT', amount: '-100' })
   })

   test('records a refused order and finishes the run as partial', async () => {
      const rebalancedAt = (await service().overview()).portfolios[0]!.lastRebalancedAt
      const plan = await service().plan({ execution: 'market', portfolioId, kind: 'withdraw', amount: '500' })
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
      const plan = await service().plan({ execution: 'market', portfolioId, kind: 'withdraw', amount: '100' })

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

      const plan = await portfolios.plan({ execution: 'market', portfolioId, kind: 'rebalance' })
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

      const plan = await portfolios.plan({ execution: 'market', portfolioId, kind: 'rebalance' })
      expect(plan.orders[0]).toMatchObject({ fee: { asset: 'BTC', amount: '0.000002' }, feeRate: '0.001', feeRateAssumed: true })
   })
})

describe('a fee charged in a third coin', () => {

   test('is valued at the price of that coin when the order filled', async () => {
      const discounted = new FakeExchange()
      discounted.accountId = 'third-coin-fees'
      discounted.feeAsset = 'MNT'
      discounted.balances.set('MNT', Big(10))
      const portfolios = new PortfolioService(venue, discounted)

      const { id: portfolioId } = await portfolios.save({
         name: 'Discounted', quoteAsset: 'USDT', band: '2', targets: [{ asset: 'BTC', weight: '100' }]
      })
      await portfolios.deposit({ portfolioId, asset: 'USDT', amount: '100' })

      prices.MNTUSDT = { last: '0.5', bid: '0.5', ask: '0.5' }
      try {
         const plan = await portfolios.plan({ execution: 'market', portfolioId, kind: 'rebalance' })
         const run = await finished((await portfolios.execute({ planId: plan.planId })).run.id, portfolios)
         expect(run.orders[0]!.fees).toEqual([{ asset: 'MNT', amount: '0.2' }])

         prices.MNTUSDT = { last: '2', bid: '2', ask: '2' }
         const portfolio = (await portfolios.overview()).portfolios.find(({ id }) => id === portfolioId)!
         expect(portfolio.fees).toBe('0.1')
         expect(portfolio.feesUnvalued).toEqual([])
      }
      finally {
         delete prices.MNTUSDT
      }
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
         const plan = await service().plan({ execution: 'market', portfolioId, kind: 'withdraw', amount: '120' })
         await finished((await service().execute({ planId: plan.planId })).run.id)

         const portfolio = (await service().overview()).portfolios.find(({ id }) => id === portfolioId)!
         const btc = portfolio.holdings.find(({ asset }) => asset === 'BTC')!

         expect(Big(btc.unrealized!).eq(Big(btc.quantity).times(10000))).toBe(true)
         expect(Big(btc.realized).gt(0)).toBe(true)
         expect(Big(btc.realizedPercent!).gt(0)).toBe(true)
         expect(portfolio.closedRealized).toBe('0')
         expect(Big(portfolio.realized).plus(portfolio.unrealized).eq(portfolio.profit)).toBe(true)
         expect(Big(portfolio.realizedPercent!).gt(0)).toBe(true)
         expect(Big(portfolio.fees).gt(0)).toBe(true)
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
      const plan = await service().plan({ execution: 'market', portfolioId, kind: 'rebalance' })
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
      const plan = await service().plan({ execution: 'market', portfolioId, kind: 'rebalance', band: '0' })
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

         const plan = await reserving.plan({ execution: 'market', portfolioId: id, kind: 'rebalance' })
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

describe('the Supertrend levels', () => {

   const falling = (count: number): SpotCandle[] => Array.from({ length: count }, (_, index) => ({
      time: index * 86400000,
      high: String(305 - 10 * index),
      low: String(295 - 10 * index),
      close: String(296 - 10 * index)
   }))

   test('cover each coin of a portfolio in its quote, per timeframe', async () => {
      await service().save({
         name: 'Trend', quoteAsset: 'USDT', band: '1',
         targets: [{ asset: 'BTC', weight: '50' }, { asset: 'ETH', weight: '30' }, { asset: 'USDT', weight: '20' }]
      })
      exchange.candleSeries.set('BTCUSDT:1d', falling(11))
      exchange.candleSeries.set('BTCUSDT:1w', falling(10))

      const { levels } = await service().supertrend()

      expect(levels.BTCUSDT).toEqual({ daily: { flipPrice: '232.73', trend: 'down' }, weekly: null })
      expect(levels.USDTUSDT).toBeUndefined()
   })

   test('leave a coin whose candles cannot be read without a level', async () => {
      const { levels } = await service().supertrend()

      expect(levels.ETHUSDT).toEqual({ daily: null, weekly: null })
   })
})

describe('limit orders', () => {

   const resting = new FakeExchange()
   resting.accountId = 'limit-orders'
   resting.balances.set('USDT', Big(20000))
   const portfolios = () => new PortfolioService(venue, resting)
   const restingOrders = () => [...resting.limits.values()]

   async function funded(name: string, targets = [{ asset: 'BTC', weight: '100' }]): Promise<number> {
      const { id } = await portfolios().save({ name, quoteAsset: 'USDT', band: '1', targets })
      await portfolios().deposit({ portfolioId: id, asset: 'USDT', amount: '1000' })
      return id
   }

   async function started(request: Record<string, unknown>): Promise<string> {
      const plan = await portfolios().plan(request)
      return (await portfolios().execute({ planId: plan.planId })).run.id
   }

   test('rest a buy one tick under the ask and pay the maker fee', async () => {
      const portfolioId = await funded('Resting')

      const plan = await portfolios().plan({ portfolioId, kind: 'rebalance' })
      expect(plan).toMatchObject({ execution: 'limit', wait: '120' })
      expect(plan.orders[0]).toMatchObject({ feeRate: '0.0004', feeRateAssumed: false })

      const run = await finished((await portfolios().execute({ planId: plan.planId })).run.id, portfolios())

      expect(run).toMatchObject({ status: 'done', execution: 'limit' })
      expect(run.orders[0]).toMatchObject({
         status: 'filled', base: '0.02', averagePrice: '49999.99', limitPrice: '49999.99', attempts: 1,
         fees: [{ asset: 'BTC', amount: '0.000008' }]
      })
   })

   test('rest a sell one tick over the bid', async () => {
      const portfolioId = await funded('Selling')
      await finished(await started({ portfolioId, kind: 'rebalance' }), portfolios())

      const run = await finished(await started({ portfolioId, kind: 'withdraw', amount: '500' }), portfolios())

      expect(run.orders[0]).toMatchObject({ side: 'sell', status: 'filled', limitPrice: '50000.01' })
      expect(run.status).toBe('done')
   })

   test('follow the price as one order, up to the slippage allowed', async () => {
      const portfolioId = await funded('Following')
      resting.fillsLimits = false

      try {
         const runId = await started({ portfolioId, kind: 'rebalance', slippage: '1' })
         await until(() => restingOrders()[0]?.price.eq('49999.99') ?? false)

         prices.BTCUSDT = quoted('50200')
         await until(() => restingOrders()[0]?.price.eq('50199.99') ?? false)

         prices.BTCUSDT = quoted('51000')
         await until(() => restingOrders()[0]?.price.eq('50500') ?? false)

         resting.fillsLimits = true
         const run = await finished(runId, portfolios())

         expect(run.orders).toHaveLength(1)
         expect(run.orders[0]).toMatchObject({ status: 'filled', attempts: 3, limitPrice: '50500', error: null })
         expect(run.status).toBe('done')
      }
      finally {
         resting.fillsLimits = true
         prices.BTCUSDT = quoted('50000')
      }
   })

   test('stay where they are until they have rested as long as the exchange asks', async () => {
      const portfolioId = await funded('Patient')
      resting.fillsLimits = false
      resting.chasePacing = { pollMs: 20, moveAfterMs: 600, pollsTakeTurns: false }

      try {
         const runId = await started({ portfolioId, kind: 'rebalance' })
         await until(() => resting.limits.size === 1)

         prices.BTCUSDT = quoted('50100')
         await new Promise(resolve => setTimeout(resolve, 200))
         expect(restingOrders()[0]!.price.toFixed()).toBe('49999.99')

         await until(() => restingOrders()[0]?.price.eq('50099.99') ?? false)

         resting.fillsLimits = true
         expect((await finished(runId, portfolios())).orders[0]).toMatchObject({ status: 'filled', attempts: 2 })
      }
      finally {
         resting.fillsLimits = true
         resting.chasePacing = { pollMs: 20, moveAfterMs: 0, pollsTakeTurns: false }
         prices.BTCUSDT = quoted('50000')
      }
   })

   test('keep what filled before the order moved, and buy only the rest', async () => {
      const portfolioId = await funded('Moving')
      resting.fillsLimits = false

      try {
         const runId = await started({ portfolioId, kind: 'rebalance' })
         await until(() => resting.limits.size === 1)

         const first = restingOrders()[0]!
         resting.fillLimit(first.clientOrderId, '0.005')
         prices.BTCUSDT = quoted('50100')
         await until(() => restingOrders()[0]?.price.eq('50099.99') ?? false)

         resting.fillsLimits = true
         const run = await finished(runId, portfolios())

         expect(run.orders[0]).toMatchObject({
            status: 'filled', attempts: 2, base: '0.01997', quote: '999.9968003',
            fees: [{ asset: 'BTC', amount: '0.000007988' }]
         })

         const portfolio = (await portfolios().overview()).portfolios.find(({ id }) => id === portfolioId)!
         expect(portfolio.holdings.find(({ asset }) => asset === 'BTC')!.quantity).toBe('0.01996201')
      }
      finally {
         resting.fillsLimits = true
         prices.BTCUSDT = quoted('50000')
      }
   })

   test('cancel what is left once the time allowed is up', async () => {
      const portfolioId = await funded('Waiting')
      resting.fillsLimits = false

      try {
         const run = await finished(await started({ portfolioId, kind: 'rebalance', wait: '1' }), portfolios())

         expect(run.status).toBe('partial')
         expect(run.orders[0]).toMatchObject({ status: 'cancelled', base: '0', error: 'Not filled within 1 s.' })
         expect(resting.limits.size).toBe(0)
      }
      finally {
         resting.fillsLimits = true
      }
   })

   test('are placed again when the exchange refuses one as a taker', async () => {
      const portfolioId = await funded('Refused')
      resting.refusesLimits = 2

      const run = await finished(await started({ portfolioId, kind: 'rebalance' }), portfolios())

      expect(run.orders[0]).toMatchObject({ status: 'filled', attempts: 1 })
      expect(resting.refusesLimits).toBe(0)
   })

   test('rest side by side, one order a market', async () => {
      const portfolioId = await funded('Together', [{ asset: 'BTC', weight: '50' }, { asset: 'ETH', weight: '50' }])
      resting.fillsLimits = false

      try {
         const runId = await started({ portfolioId, kind: 'rebalance' })
         await until(() => resting.limits.size === 2)
         expect(restingOrders().map(({ symbol }) => symbol)).toEqual(['BTCUSDT', 'ETHUSDT'])

         resting.fillsLimits = true
         const run = await finished(runId, portfolios())

         expect(run.status).toBe('done')
         expect(run.orders.map(({ status }) => status)).toEqual(['filled', 'filled'])
      }
      finally {
         resting.fillsLimits = true
      }
   })

   test('stop on request, every one of them on the book', async () => {
      const portfolioId = await funded('Stopped', [{ asset: 'BTC', weight: '50' }, { asset: 'ETH', weight: '50' }])
      resting.fillsLimits = false

      try {
         const runId = await started({ portfolioId, kind: 'rebalance' })
         await until(() => resting.limits.size === 2)

         const { run: stopping } = await portfolios().stop({ runId })
         expect(stopping.stopping).toBe(true)

         const run = await finished(runId, portfolios())

         expect(run.status).toBe('partial')
         expect(run.orders.map(({ status, error }) => `${status}: ${error}`))
            .toEqual(['cancelled: The run was stopped.', 'cancelled: The run was stopped.'])
         expect(resting.limits.size).toBe(0)
      }
      finally {
         resting.fillsLimits = true
      }
   })

   test('leave the buys alone when the run is stopped while the sells rest', async () => {
      const portfolioId = await funded('Rotating')
      await finished(await started({ portfolioId, kind: 'rebalance' }), portfolios())
      await portfolios().save({
         id: portfolioId, name: 'Rotating', quoteAsset: 'USDT', band: '1', targets: [{ asset: 'ETH', weight: '100' }]
      })
      resting.fillsLimits = false

      try {
         const runId = await started({ portfolioId, kind: 'rebalance' })
         await until(() => resting.limits.size === 1)
         await portfolios().stop({ runId })

         const run = await finished(runId, portfolios())

         expect(run.orders.map(({ side, status, error }) => `${side} ${status}: ${error}`))
            .toEqual(['sell cancelled: The run was stopped.', 'buy skipped: The run was stopped.'])
      }
      finally {
         resting.fillsLimits = true
      }
   })

   test('left resting by a run the server no longer tracks are cancelled, keeping what filled', async () => {
      const portfolioId = await funded('Abandoned')
      const repository = new PortfolioRepository('bybitDemo', resting.accountId)

      repository.createRun({
         id: 'abandoned-run', portfolioId, kind: 'rebalance', status: 'running',
         withdraw: '0', reserve: '0', slippage: '1', execution: 'limit', startedAt: Date.now()
      }, [{
         orderLinkId: 'pf-abandoned-1', seq: 1, symbol: 'BTCUSDT', side: 'buy',
         baseAsset: 'BTC', quoteAsset: 'USDT', unit: 'quote', requested: '1000'
      }])
      resting.fillsLimits = false

      try {
         const orderId = await resting.placeLimitOrder({
            clientOrderId: 'pf-abandoned-1', symbol: 'BTCUSDT', side: 'buy', quantity: '0.02', price: '49999.99'
         })
         repository.markOrder('pf-abandoned-1', { status: 'placed', orderId, limitPrice: '49999.99' })
         resting.fillLimit('pf-abandoned-1', '0.004')

         await portfolios().overview()
         const { run } = await portfolios().run({ runId: 'abandoned-run' })

         expect(run.status).toBe('interrupted')
         expect(run.orders[0]).toMatchObject({
            status: 'partial', base: '0.004', error: 'Cancelled: the run stopped first.'
         })
         expect(resting.limits.size).toBe(0)
      }
      finally {
         resting.fillsLimits = true
      }
   })
})

describe('orders placed side by side', () => {

   async function marketRun(fake: FakeExchange): Promise<string[]> {
      const portfolios = new PortfolioService(venue, fake)
      const { id: portfolioId } = await portfolios.save({
         name: 'Pair', quoteAsset: 'USDT', band: '1',
         targets: [{ asset: 'BTC', weight: '50' }, { asset: 'ETH', weight: '50' }]
      })
      await portfolios.deposit({ portfolioId, asset: 'USDT', amount: '1000' })

      const plan = await portfolios.plan({ execution: 'market', portfolioId, kind: 'rebalance' })
      const run = await finished((await portfolios.execute({ planId: plan.planId })).run.id, portfolios)

      expect(run.status).toBe('done')
      return fake.marketCalls
   }

   test('go to the exchange together as market orders', async () => {
      const together = new FakeExchange()
      together.accountId = 'side-by-side'

      expect(await marketRun(together)).toEqual(['place BTCUSDT', 'place ETHUSDT', 'check BTCUSDT', 'check ETHUSDT'])
   })

   test('go one after the other as market orders where every check counts against one budget', async () => {
      const budgeted = new FakeExchange()
      budgeted.accountId = 'one-budget'
      budgeted.chasePacing = { pollMs: 20, moveAfterMs: 0, pollsTakeTurns: true }

      expect(await marketRun(budgeted)).toEqual(['place BTCUSDT', 'check BTCUSDT', 'place ETHUSDT', 'check ETHUSDT'])
   })

   test('still rest together as limit orders there, checked in turn', async () => {
      const budgeted = new FakeExchange()
      budgeted.accountId = 'one-budget-limits'
      budgeted.chasePacing = { pollMs: 20, moveAfterMs: 0, pollsTakeTurns: true }
      budgeted.fillsLimits = false
      const portfolios = new PortfolioService(venue, budgeted)

      const { id: portfolioId } = await portfolios.save({
         name: 'Turns', quoteAsset: 'USDT', band: '1',
         targets: [{ asset: 'BTC', weight: '50' }, { asset: 'ETH', weight: '50' }]
      })
      await portfolios.deposit({ portfolioId, asset: 'USDT', amount: '1000' })

      const plan = await portfolios.plan({ portfolioId, kind: 'rebalance' })
      const { run } = await portfolios.execute({ planId: plan.planId })
      await until(() => budgeted.limits.size === 2)

      budgeted.fillsLimits = true
      expect((await finished(run.id, portfolios)).status).toBe('done')
   })
})

describe('a coin withdrawn as it is', () => {

   let portfolioId: number

   const portfolioNow = async () => (await service().overview()).portfolios.find(({ id }) => id === portfolioId)!

   test('leaves at the price of the moment, which realizes the profit on it', async () => {
      portfolioId = (await service().save({
         name: 'In kind', quoteAsset: 'USDT', band: '1', targets: [{ asset: 'BTC', weight: '100' }]
      })).id
      await service().deposit({ portfolioId, asset: 'BTC', amount: '0.01' })

      const before = prices.BTCUSDT!
      prices.BTCUSDT = quoted('60000')
      try {
         const { movement } = await service().withdraw({ portfolioId, asset: 'btc', amount: '0.004' })
         expect(movement).toMatchObject({ kind: 'withdraw', asset: 'BTC', amount: '-0.004', value: '240' })

         const portfolio = await portfolioNow()
         expect(portfolio.holdings.find(({ asset }) => asset === 'BTC')!.quantity).toBe('0.006')
         expect(portfolio).toMatchObject({ netInvested: '260', realized: '40', unrealized: '60', profit: '100' })

         const btc = (await service().overview()).coins.find(({ asset }) => asset === 'BTC')!
         expect(btc.allocated).toBe('0.006')
      }
      finally {
         prices.BTCUSDT = before
      }
   })

   test('refuses more than the portfolio holds, and a coin it does not hold', async () => {
      await expect(service().withdraw({ portfolioId, asset: 'BTC', amount: '0.007' }))
         .rejects.toThrow('In kind only holds 0.006 BTC.')
      await expect(service().withdraw({ portfolioId, asset: 'ETH', amount: '1' }))
         .rejects.toThrow('In kind holds no ETH.')
   })

   test('takes out all of a coin that is no longer a target', async () => {
      await service().save({
         id: portfolioId, name: 'In kind', quoteAsset: 'USDT', band: '1', targets: [{ asset: 'ETH', weight: '100' }]
      })
      expect((await portfolioNow()).holdings.map(({ asset, target }) => `${asset} ${target}`)).toEqual(['ETH 100', 'BTC 0'])

      await service().withdraw({ portfolioId, asset: 'BTC', all: true })

      const portfolio = await portfolioNow()
      expect(portfolio.holdings.map(({ asset }) => asset)).toEqual(['ETH'])
      expect(portfolio.netInvested).toBe('-40')

      await service().archive({ portfolioId })
   })
})

describe('a coin sold out of a portfolio', () => {

   const lots = new FakeExchange()
   lots.accountId = 'sold-out'
   const portfolios = () => new PortfolioService(venue, lots)

   const btcOf = (portfolio: { holdings: { asset: string, quantity: string }[] }) =>
      portfolio.holdings.find(({ asset }) => asset === 'BTC')

   const releasesOf = async (portfolioId: number) =>
      (await portfolios().history({ portfolioId })).movements
         .filter(({ kind, asset }) => kind === 'withdraw' && asset === 'BTC')
         .map(({ amount, value, note }) => ({ amount, value, note }))

   async function overviewOf(portfolioId: number) {
      const overview = await portfolios().overview()
      return { overview, portfolio: overview.portfolios.find(({ id }) => id === portfolioId)! }
   }

   async function untargetedBtc(name: string): Promise<number> {
      const portfolio = { name, quoteAsset: 'USDT', band: '1' }
      const { id } = await portfolios().save({ ...portfolio, targets: [{ asset: 'BTC', weight: '100' }] })
      await portfolios().deposit({ portfolioId: id, asset: 'USDT', amount: '123' })

      const plan = await portfolios().plan({ portfolioId: id, kind: 'rebalance', execution: 'market' })
      await finished((await portfolios().execute({ planId: plan.planId })).run.id, portfolios())
      await portfolios().save({ ...portfolio, id, targets: [{ asset: 'USDT', weight: '100' }] })

      expect(btcOf((await overviewOf(id)).portfolio)!.quantity).toBe('0.00245754')
      return id
   }

   test('gives back what a withdrawal of everything leaves below the lot size', async () => {
      const portfolioId = await untargetedBtc('Emptied')

      const plan = await portfolios().plan({ portfolioId, kind: 'withdraw', all: true, execution: 'market' })
      expect(plan.orders.map(({ side, asset, amount }) => `${side} ${asset} ${amount}`)).toEqual(['sell BTC 0.002457'])

      const run = await finished((await portfolios().execute({ planId: plan.planId })).run.id, portfolios())
      expect(run).toMatchObject({ status: 'done', withdrawn: '122.72715' })

      const { overview, portfolio } = await overviewOf(portfolioId)
      expect(portfolio.holdings.map(({ asset }) => asset)).toEqual(['USDT'])
      expect(overview.coins.find(({ asset }) => asset === 'BTC')!.allocated).toBe('0')
      expect(await releasesOf(portfolioId)).toEqual([{ amount: '-0.00000054', value: '0.027', note: 'Too small to sell.' }])

      expect(portfolio.value).toBe('0')
      expect(portfolio.netInvested).toBe('0.24585')
      expect(portfolio.profit).toBe('-0.24585')
      expect(portfolio.unrealized).toBe('0')
      expect(portfolio.realized).toBe(portfolio.profit)
      expect(portfolio.closedRealized).toBe(portfolio.profit)
   })

   test('gives it back after a rebalance sells a coin that is no longer a target', async () => {
      const portfolioId = await untargetedBtc('Rebalanced')

      const plan = await portfolios().plan({ portfolioId, kind: 'rebalance' })
      const run = await finished((await portfolios().execute({ planId: plan.planId })).run.id, portfolios())
      expect(run.orders.map(({ side, status, base }) => `${side} ${status} ${base}`)).toEqual(['sell filled 0.002457'])

      const { portfolio } = await overviewOf(portfolioId)
      expect(portfolio.holdings.map(({ asset }) => asset)).toEqual(['USDT'])
      expect(await releasesOf(portfolioId)).toHaveLength(1)
      expect(Big(portfolio.realized).plus(portfolio.unrealized).minus(portfolio.profit).abs().lte('0.00000001')).toBe(true)
   })

   test('keeps the coin when its sell only partly filled, even if what is left cannot be sold', async () => {
      const portfolioId = await untargetedBtc('Half sold')
      lots.fillsLimits = false

      try {
         const plan = await portfolios().plan({ portfolioId, kind: 'withdraw', all: true, wait: '1' })
         const runId = (await portfolios().execute({ planId: plan.planId })).run.id
         await until(() => lots.limits.size === 1)
         lots.fillLimit([...lots.limits.keys()][0]!, '0.0024')

         const run = await finished(runId, portfolios())
         expect(run.status).toBe('partial')
         expect(run.orders[0]).toMatchObject({ side: 'sell', status: 'partial', base: '0.0024' })

         const { portfolio } = await overviewOf(portfolioId)
         expect(btcOf(portfolio)!.quantity).toBe('0.00005754')
         expect(await releasesOf(portfolioId)).toEqual([])
      }
      finally {
         lots.fillsLimits = true
      }
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
         withdraw: '0', reserve: '0', slippage: '1', execution: 'market', startedAt: Date.now()
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
