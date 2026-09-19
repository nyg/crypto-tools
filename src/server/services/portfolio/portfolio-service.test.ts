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
   ExchangeAccount, OrderRequest, OrderSettlement, SpotMarket, SpotPrice, WalletCoin
} from '../../../types/portfolio'

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crypto-tools-portfolio-'))

const prices: Record<string, SpotPrice> = {
   BTCUSDT: { last: '50000', bid: '50000', ask: '50000' },
   ETHUSDT: { last: '2500', bid: '2500', ask: '2500' }
}

const market = (base: string): SpotMarket => ({
   symbol: `${base}USDT`, base, quote: 'USDT', baseStep: '0.000001', quoteStep: '0.01',
   minQty: '0.000001', minAmount: '5', maxQty: '1000', maxAmount: '10000000'
})

class FakeExchange implements PortfolioExchange {

   readonly balances = new Map<string, Big>([['USDT', Big(10000)], ['BTC', Big('0.5')]])
   readonly settlements = new Map<string, OrderSettlement>()
   rejectNext = false
   accountId = 'uid-1'

   async account(): Promise<ExchangeAccount> {
      return { accountId: this.accountId, canTrade: true, expiresAt: null }
   }

   async wallet(): Promise<WalletCoin[]> {
      return [...this.balances].map(([asset, total]) =>
         ({ asset, total: total.toFixed(), free: total.toFixed(), borrowed: '0' }))
   }

   async markets(): Promise<SpotMarket[]> {
      return [market('BTC'), market('ETH')]
   }

   async prices(): Promise<Record<string, SpotPrice>> {
      return prices
   }

   async placeOrder({ clientOrderId, symbol, side, unit, amount }: OrderRequest): Promise<string> {
      if (this.rejectNext) {
         this.rejectNext = false
         throw new HttpRequesterError(200, { retCode: 170131, retMsg: 'Insufficient balance.' })
      }

      const base = symbol.replace(/USDT$/, '')
      const price = Big(prices[symbol]!.last)
      const quantity = unit === 'base' ? Big(amount) : Big(amount).div(price).round(6, Big.roundDown)
      const value = quantity.times(price)
      const fee = side === 'buy' ? quantity.times('0.001') : value.times('0.001')
      const sign = side === 'buy' ? 1 : -1

      this.#move(base, quantity.times(sign).minus(side === 'buy' ? fee : 0))
      this.#move('USDT', value.times(-sign).minus(side === 'sell' ? fee : 0))

      this.settlements.set(clientOrderId, {
         orderId: `order-${this.settlements.size + 1}`, status: 'filled',
         base: quantity.toFixed(), quote: value.toFixed(), averagePrice: price.toFixed(),
         fees: { [side === 'buy' ? base : 'USDT']: fee.toFixed() }, reason: ''
      })
      return `order-${this.settlements.size}`
   }

   async settleOrder(clientOrderId: string): Promise<OrderSettlement | null> {
      return this.settlements.get(clientOrderId) ?? null
   }

   #move(asset: string, amount: Big) {
      this.balances.set(asset, (this.balances.get(asset) ?? Big(0)).plus(amount))
   }
}

let PortfolioService: typeof PortfolioServiceType
let PortfolioError: typeof import('./portfolio-service').PortfolioError
let PortfolioRepository: typeof import('../../db/portfolio-repository').default

const exchange = new FakeExchange()
const venue: Venue = { id: 'bybitDemo', provider: 'bybitDemo', label: 'Fake', exchange: () => exchange }

const service = () => new PortfolioService(venue, exchange)

async function finished(runId: string) {
   for (let attempt = 0; attempt < 100; attempt++) {
      const { run } = await service().run({ runId })
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

afterAll(() => fs.rmSync(dataDir, { recursive: true, force: true }))

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
   })

   test('rebalances into the targets through market orders', async () => {
      const plan = await service().plan({ portfolioId, kind: 'rebalance' })
      expect(plan.orders.map(({ side, asset, amount }) => `${side} ${asset} ${amount}`))
         .toEqual(['buy BTC 500', 'buy ETH 300'])

      const { run } = await service().execute({ planId: plan.planId })
      const done = await finished(run.id)

      expect(done.status).toBe('done')
      expect(done.orders.every(({ status }) => status === 'filled')).toBe(true)
      expect(done.orders[0]!.fees).toEqual([{ asset: 'BTC', amount: '0.00001' }])

      const overview = await service().overview()
      const btc = overview.portfolios[0]!.holdings.find(({ asset }) => asset === 'BTC')!
      expect(btc.quantity).toBe('0.00999')
      expect(overview.portfolios[0]!.needsRebalance).toBe(false)
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
      const plan = await service().plan({ portfolioId, kind: 'withdraw', amount: '500' })
      expect(plan.orders.length).toBeGreaterThan(0)

      exchange.rejectNext = true
      const run = await finished((await service().execute({ planId: plan.planId })).run.id)

      expect(run.orders[0]!.status).toBe('rejected')
      expect(run.orders[0]!.error).toContain('Insufficient balance')
      expect(run.status).toBe('partial')
   })

   test('releases its holdings to unallocated when archived', async () => {
      await service().archive({ portfolioId })

      const overview = await service().overview()
      expect(overview.portfolios).toHaveLength(0)
      expect(overview.coins.every(({ allocated }) => allocated === '0')).toBe(true)
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
