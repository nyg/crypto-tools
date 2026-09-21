import Big from 'big.js'
import { planPortfolio, PlanError } from '../../../../src/server/services/portfolio/planner'
import type { PlanMarket } from '../../../../src/server/services/portfolio/planner'
import type {
   AccountCoin, PortfolioArchiveRequest, PortfolioArchiveResponse, PortfolioExecuteRequest,
   PortfolioHistoryRequest, PortfolioHistoryResponse, PortfolioHolding, PortfolioMarketsResponse,
   PortfolioMovement, PortfolioMovementRequest, PortfolioMovementResponse, PortfolioOverviewResponse,
   PortfolioPlanOrder, PortfolioPlanRequest, PortfolioPlanResponse, PortfolioRun, PortfolioRunRequest,
   PortfolioRunResponse, PortfolioSaveRequest, PortfolioSaveResponse, PortfolioSummary, PortfolioTarget
} from '../../../../src/types/api'
import type { VenueId } from '../../../../src/types/portfolio'

const prices: Record<string, number> = {
   USDT: 1, USDC: 1, BTC: 112480, ETH: 4310, SOL: 212.4, NEAR: 2.94, VVV: 3.46, PUMP: 0.0062, COOKIE: 0.238,
   SUI: 3.62, TAO: 405, ENA: 0.71, DOGE: 0.24, XRP: 2.91, LINK: 23.4, AVAX: 29.8
}

const steps: Record<string, string> = {
   BTC: '0.000001', ETH: '0.00001', SOL: '0.001', NEAR: '0.1', VVV: '0.01', PUMP: '1', COOKIE: '1'
}

const FEE_RATE = 0.001

let clockOffset = 0
const now = () => Date.now() + clockOffset

interface MockPortfolio {
   id: number
   name: string
   quoteAsset: string
   band: string
   createdAt: number
   targets: PortfolioTarget[]
   holdings: Record<string, number>
   costs: Record<string, number>
   realized: Record<string, number>
   closedRealized: number
}

interface MockPlan {
   portfolioId: number
   orders: PortfolioPlanOrder[]
   withdraw: number
}

interface MockRun {
   run: PortfolioRun
   polls: number
}

interface VenueState {
   wallet: Record<string, number>
   portfolios: MockPortfolio[]
   movements: Map<number, PortfolioMovement[]>
   runs: Map<string, MockRun>
   plans: Map<string, MockPlan>
   nextId: number
}

function seed(venue: VenueId): VenueState {
   return {
      wallet: venue === 'bybit'
         ? { USDT: 12000, BTC: 0.0421, ETH: 0.652, USDC: 300 }
         : { USDT: 50000, BTC: 1, ETH: 10 },
      portfolios: [],
      movements: new Map(),
      runs: new Map(),
      plans: new Map(),
      nextId: 1
   }
}

const states = new Map<VenueId, VenueState>()
const stateOf = (venue: VenueId) => {
   if (!states.has(venue)) states.set(venue, seed(venue))
   return states.get(venue)!
}

const fixed = (value: number, places = 8) => String(Number(value.toFixed(places)))

const valueOf = (portfolio: MockPortfolio) =>
   Object.entries(portfolio.holdings).reduce((sum, [asset, amount]) => sum + amount * (prices[asset] ?? 0), 0)

function summarize(state: VenueState, portfolio: MockPortfolio): PortfolioSummary {

   const total = valueOf(portfolio)
   const weights = new Map(portfolio.targets.map(({ asset, weight }) => [asset, Number(weight)]))
   const assets = [...weights.keys(), ...Object.keys(portfolio.holdings).filter(asset => !weights.has(asset))]

   const holdings: PortfolioHolding[] = assets.map(asset => {
      const quantity = portfolio.holdings[asset] ?? 0
      const price = prices[asset] ?? null
      const value = price === null ? null : quantity * price
      const weight = value !== null && total > 0 ? value / total * 100 : null
      const target = weights.get(asset) ?? 0
      const cost = asset === portfolio.quoteAsset ? undefined : portfolio.costs[asset]
      return {
         asset,
         quantity: fixed(quantity),
         price: price === null ? null : String(price),
         value: value === null ? null : fixed(value),
         valueNum: value ?? 0,
         weight: weight === null ? null : fixed(weight, 4),
         target: String(target),
         drift: weight === null ? null : fixed(weight - target, 4),
         unrealized: cost !== undefined && value !== null ? fixed(value - cost) : null,
         realized: fixed(portfolio.realized[asset] ?? 0),
         stopPrice: portfolio.targets.find(target => target.asset === asset)?.stopPrice ?? null,
         stopStatus: null
      }
   })

   const realized = Object.values(portfolio.realized).reduce((sum, amount) => sum + amount, portfolio.closedRealized)
   const unrealized = holdings.reduce((sum, holding) => sum + Number(holding.unrealized ?? 0), 0)

   const maxDrift = Math.max(0, ...holdings.map(({ drift }) => Math.abs(Number(drift ?? 0))))
   const netInvested = (state.movements.get(portfolio.id) ?? []).reduce((sum, { kind, value }) =>
      kind === 'deposit' ? sum + Number(value) : kind === 'withdraw' ? sum - Number(value) : sum, 0)

   return {
      id: portfolio.id,
      name: portfolio.name,
      quoteAsset: portfolio.quoteAsset,
      band: portfolio.band,
      createdAt: portfolio.createdAt,
      targets: portfolio.targets,
      holdings,
      value: fixed(total),
      valueNum: total,
      netInvested: fixed(netInvested),
      profit: fixed(total - netInvested),
      realized: fixed(realized),
      unrealized: fixed(unrealized),
      closedRealized: fixed(portfolio.closedRealized),
      maxDrift: fixed(maxDrift, 4),
      needsRebalance: total > 0 && maxDrift > Number(portfolio.band),
      quoteLocked: (state.movements.get(portfolio.id) ?? []).length > 0,
      stops: []
   }
}

function coinsOf(state: VenueState): AccountCoin[] {
   const allocated: Record<string, number> = {}
   for (const portfolio of state.portfolios) {
      for (const [asset, amount] of Object.entries(portfolio.holdings)) allocated[asset] = (allocated[asset] ?? 0) + amount
   }

   return [...new Set([...Object.keys(state.wallet), ...Object.keys(allocated)])]
      .map(asset => {
         const wallet = state.wallet[asset] ?? 0
         const assigned = allocated[asset] ?? 0
         const unallocated = Math.abs(wallet - assigned) < 1e-9 ? 0 : wallet - assigned
         const value = unallocated * (prices[asset] ?? 0)
         return {
            asset,
            wallet: fixed(wallet),
            free: fixed(wallet),
            allocated: fixed(assigned),
            unallocated: fixed(unallocated),
            value: fixed(value, 2),
            valueNum: value,
            overallocated: unallocated < -1e-9
         }
      })
      .filter(coin => coin.wallet !== '0' || coin.allocated !== '0')
      .toSorted((left, right) => right.valueNum - left.valueNum)
}

const activeRunOf = (state: VenueState) =>
   [...state.runs.values()].find(({ run }) => run.running)?.run

function overview(venue: VenueId): PortfolioOverviewResponse {
   const state = stateOf(venue)
   const coins = coinsOf(state)
   const activeRun = activeRunOf(state)
   return {
      fetchedAt: Date.now(),
      venue,
      accountId: venue === 'bybit' ? '100200300' : '900800700',
      key: { canTrade: true, expiresAt: null },
      valuationAsset: 'USDT',
      coins,
      totalValue: fixed(Object.entries(state.wallet).reduce((sum, [asset, amount]) => sum + amount * (prices[asset] ?? 0), 0), 2),
      unallocatedValue: fixed(coins.reduce((sum, coin) => sum + Math.max(0, coin.valueNum), 0), 2),
      portfolios: state.portfolios.map(portfolio => summarize(state, portfolio)),
      activeRun: activeRun ? { id: activeRun.id, portfolioId: activeRun.portfolioId } : null,
      reconciled: 0,
      hardStops: true,
      stopsSyncing: false,
      stopFills: []
   }
}

const markets = (): PortfolioMarketsResponse => ({
   quoteAssets: ['USDT', 'USDC'],
   markets: Object.keys(prices)
      .filter(asset => !['USDT', 'USDC'].includes(asset))
      .toSorted()
      .flatMap(base => [
         { symbol: `${base}USDT`, base, quote: 'USDT' },
         { symbol: `${base}USDC`, base, quote: 'USDC' }
      ])
})

const reject = (message: string) => Promise.reject(message)

function save(venue: VenueId, request?: PortfolioSaveRequest): PortfolioSaveResponse | Promise<never> {
   const state = stateOf(venue)
   if (!request) return reject('Nothing to save.')

   const total = request.targets.reduce((sum, { weight }) => sum + Number(weight), 0)
   if (Math.abs(total - 100) > 1e-9) return reject(`The weights add up to ${total}%, not 100%.`)
   if (state.portfolios.some(({ id, name }) => name === request.name && id !== request.id)) {
      return reject(`A portfolio named "${request.name}" already exists.`)
   }

   const existing = state.portfolios.find(({ id }) => id === request.id)
   if (existing) {
      Object.assign(existing, { name: request.name, quoteAsset: request.quoteAsset, band: request.band, targets: request.targets })
      return { id: existing.id }
   }

   const id = state.nextId++
   state.portfolios.push({
      id, name: request.name, quoteAsset: request.quoteAsset, band: request.band,
      createdAt: now(), targets: request.targets, holdings: {}, costs: {}, realized: {}, closedRealized: 0
   })
   return { id }
}

function archive(venue: VenueId, request?: PortfolioArchiveRequest): PortfolioArchiveResponse {
   const state = stateOf(venue)
   state.portfolios = state.portfolios.filter(({ id }) => id !== request?.portfolioId)
   return { archived: request?.portfolioId ?? 0 }
}

function dispose(portfolio: MockPortfolio, asset: string, quantity: number, proceeds: number) {
   const held = portfolio.holdings[asset] ?? 0
   const cost = portfolio.costs[asset] ?? 0
   const released = held > quantity ? cost * quantity / held : cost
   portfolio.costs[asset] = cost - released
   portfolio.realized[asset] = (portfolio.realized[asset] ?? 0) + proceeds - released
}

function trackCost(portfolio: MockPortfolio, { kind, asset, amount, value }: Omit<PortfolioMovement, 'id' | 'createdAt'>) {
   const quantity = Number(amount)
   if (asset === portfolio.quoteAsset) {
      if (kind === 'adjust') portfolio.realized[asset] = (portfolio.realized[asset] ?? 0) + quantity
   }
   else if (quantity > 0) portfolio.costs[asset] = (portfolio.costs[asset] ?? 0) + (kind === 'deposit' ? Number(value) : 0)
   else dispose(portfolio, asset, -quantity, kind === 'withdraw' ? Math.abs(Number(value)) : 0)
}

function addMovement(state: VenueState, portfolio: MockPortfolio, movement: Omit<PortfolioMovement, 'id' | 'createdAt'>): PortfolioMovement {
   const entry = { ...movement, id: state.nextId++, createdAt: now() }
   state.movements.set(portfolio.id, [entry, ...state.movements.get(portfolio.id) ?? []])
   trackCost(portfolio, movement)
   portfolio.holdings[movement.asset] = (portfolio.holdings[movement.asset] ?? 0) + Number(movement.amount)
   return entry
}

function deposit(venue: VenueId, request?: PortfolioMovementRequest): PortfolioMovementResponse | Promise<never> {
   const state = stateOf(venue)
   const portfolio = state.portfolios.find(({ id }) => id === request?.portfolioId)
   if (!portfolio || !request) return reject('This portfolio does not exist.')

   if (request.asset !== portfolio.quoteAsset && !portfolio.targets.some(({ asset }) => asset === request.asset)) {
      return reject(`${request.asset} is not one of ${portfolio.name}'s targets. Deposit ${portfolio.quoteAsset} or a coin it targets.`)
   }

   const coin = coinsOf(state).find(({ asset }) => asset === request.asset)
   const amount = Number(request.amount)
   if (!coin || amount > Number(coin.unallocated)) {
      return reject(`Only ${coin?.unallocated ?? 0} ${request.asset} is free and not already in a portfolio.`)
   }

   const movement = addMovement(state, portfolio, {
      kind: 'deposit', asset: request.asset, amount: request.amount,
      value: fixed(amount * (prices[request.asset] ?? 0)), orderLinkId: null, note: ''
   })
   return { movement }
}

function adjust(venue: VenueId, request?: PortfolioMovementRequest): PortfolioMovementResponse | Promise<never> {
   const state = stateOf(venue)
   const portfolio = state.portfolios.find(({ id }) => id === request?.portfolioId)
   if (!portfolio || !request) return reject('This portfolio does not exist.')

   const movement = addMovement(state, portfolio, {
      kind: 'adjust', asset: request.asset, amount: request.amount,
      value: fixed(Number(request.amount) * (prices[request.asset] ?? 0)), orderLinkId: null, note: request.note ?? ''
   })
   return { movement }
}

function marketOf(base: string, quote: string): PlanMarket {
   const last = Big(prices[base] ?? 0)
   return {
      symbol: `${base}${quote}`, base, quote, last, bid: last, ask: last,
      baseStep: Big(steps[base] ?? '0.0001'), quoteStep: Big('0.01'), tickStep: Big('0.01'),
      minQty: Big(steps[base] ?? '0.0001'), minAmount: Big(5),
      maxQty: Big(1e12), maxAmount: Big(1e7)
   }
}

function plan(venue: VenueId, request?: PortfolioPlanRequest): PortfolioPlanResponse | Promise<never> {
   const state = stateOf(venue)
   const portfolio = state.portfolios.find(({ id }) => id === request?.portfolioId)
   if (!portfolio || !request) return reject('This portfolio does not exist.')

   const quote = portfolio.quoteAsset
   const band = request.band ?? portfolio.band
   const assets = [...new Set([...portfolio.targets.map(({ asset }) => asset), ...Object.keys(portfolio.holdings)])]
   const coins = coinsOf(state)

   let result
   try {
      result = planPortfolio({
         quote,
         holdings: new Map(Object.entries(portfolio.holdings).map(([asset, amount]) => [asset, Big(fixed(amount))])),
         targets: new Map(portfolio.targets.map(({ asset, weight }) => [asset, Big(weight)])),
         markets: new Map(assets.filter(asset => asset !== quote && prices[asset]).map(asset => [asset, marketOf(asset, quote)])),
         free: new Map(coins.map(coin => [coin.asset, Big(coin.free)])),
         band: Big(band),
         withdraw: request.kind === 'withdraw' ? (request.all ? 'all' : Big(request.amount ?? '0')) : Big(0),
         feeRate: Big(FEE_RATE)
      })
   }
   catch (error) {
      return reject(error instanceof PlanError ? error.message : String(error))
   }

   const orders: PortfolioPlanOrder[] = result.orders.map(order => ({
      asset: order.asset,
      symbol: order.symbol,
      side: order.side,
      unit: order.unit,
      amount: order.amount.toFixed(),
      price: order.price.toFixed(),
      value: order.value.toFixed(2)
   }))

   const planId = `mock-plan-${state.nextId++}`
   state.plans.set(planId, { portfolioId: portfolio.id, orders, withdraw: result.withdraw.toNumber() })

   return {
      planId,
      portfolioId: portfolio.id,
      venue,
      kind: request.kind,
      quoteAsset: quote,
      expiresAt: Date.now() + 120000,
      band: String(band),
      slippage: request.slippage ?? '1',
      total: result.total.toFixed(2),
      withdraw: result.withdraw.toFixed(2),
      orders,
      skipped: result.skipped.map(({ asset, reason, value }) => ({ asset, reason, value: value.toFixed(2) })),
      cashAfter: result.cashAfter.toFixed(2),
      shortfall: result.shortfall.toFixed(2),
      canTrade: true
   }
}

function execute(venue: VenueId, request?: PortfolioExecuteRequest): PortfolioRunResponse | Promise<never> {
   const state = stateOf(venue)
   const stored = state.plans.get(request?.planId ?? '')
   if (!stored) return reject('This preview has expired. Preview the orders again.')
   if (activeRunOf(state)) return reject('Another run is still placing orders on this account.')
   state.plans.delete(request!.planId)

   const portfolio = state.portfolios.find(({ id }) => id === stored.portfolioId)!
   const id = `run-${state.nextId++}`
   const run: PortfolioRun = {
      id,
      portfolioId: portfolio.id,
      kind: stored.withdraw > 0 ? 'withdraw' : 'rebalance',
      status: 'running',
      running: true,
      withdraw: fixed(stored.withdraw, 2),
      withdrawn: '0',
      startedAt: now(),
      finishedAt: null,
      error: null,
      orders: stored.orders.map((order, index) => ({
         orderLinkId: `pf${portfolio.id}-${id}-${index + 1}`,
         seq: index + 1,
         symbol: order.symbol,
         side: order.side,
         unit: order.unit,
         requested: order.amount,
         status: 'pending',
         base: '0',
         quote: '0',
         averagePrice: '0',
         fees: [],
         error: null
      }))
   }
   state.runs.set(id, { run, polls: 0 })
   return { run: structuredClone(run) }
}

function fill(state: VenueState, portfolio: MockPortfolio, order: PortfolioRun['orders'][number]) {
   const base = order.symbol.replace(new RegExp(`${portfolio.quoteAsset}$`), '')
   const price = prices[base] ?? 0
   const quantity = order.unit === 'base' ? Number(order.requested) : Number(order.requested) / price
   const value = quantity * price
   const buy = order.side === 'buy'
   const fee = buy ? quantity * FEE_RATE : value * FEE_RATE

   if (buy) portfolio.costs[base] = (portfolio.costs[base] ?? 0) + value
   else dispose(portfolio, base, quantity, value - fee)

   portfolio.holdings[base] = (portfolio.holdings[base] ?? 0) + (buy ? quantity - fee : -quantity)
   portfolio.holdings[portfolio.quoteAsset] = (portfolio.holdings[portfolio.quoteAsset] ?? 0) + (buy ? -value : value - fee)
   state.wallet[base] = (state.wallet[base] ?? 0) + (buy ? quantity - fee : -quantity)
   state.wallet[portfolio.quoteAsset] = (state.wallet[portfolio.quoteAsset] ?? 0) + (buy ? -value : value - fee)

   Object.assign(order, {
      status: 'filled', base: fixed(quantity, 6), quote: fixed(value, 2), averagePrice: String(price),
      fees: [{ asset: buy ? base : portfolio.quoteAsset, amount: fixed(fee, 6) }]
   })
}

function run(venue: VenueId, request?: PortfolioRunRequest): PortfolioRunResponse | Promise<never> {
   const state = stateOf(venue)
   const entry = state.runs.get(request?.runId ?? '')
   if (!entry) return reject('This run does not exist.')

   const { run: current } = entry
   const portfolio = state.portfolios.find(({ id }) => id === current.portfolioId)
   entry.polls++

   if (current.running && portfolio) {
      const next = current.orders.find(({ status }) => status === 'pending')
      if (next) fill(state, portfolio, next)
      else if (!next) {
         const withdraw = Number(current.withdraw)
         if (withdraw > 0) {
            const cash = portfolio.holdings[portfolio.quoteAsset] ?? 0
            const withdrawn = Math.min(cash, withdraw)
            addMovement(state, portfolio, {
               kind: 'withdraw', asset: portfolio.quoteAsset, amount: fixed(-withdrawn, 2),
               value: fixed(withdrawn, 2), orderLinkId: null, note: ''
            })
            current.withdrawn = fixed(withdrawn, 2)
         }
         Object.assign(current, { status: 'done', running: false, finishedAt: now() })
      }
   }

   return { run: structuredClone(current) }
}

function history(venue: VenueId, request?: PortfolioHistoryRequest): PortfolioHistoryResponse {
   const state = stateOf(venue)
   const portfolioId = request?.portfolioId ?? 0
   return {
      movements: state.movements.get(portfolioId) ?? [],
      runs: [...state.runs.values()]
         .map(({ run: entry }) => entry)
         .filter(entry => entry.portfolioId === portfolioId)
         .toSorted((left, right) => right.startedAt - left.startedAt)
   }
}

type Body = { arg?: unknown }
const arg = <T>(params?: Body) => params?.arg as T | undefined

const bases: Partial<Record<VenueId, string>> = {
   bybit: '/api/bybit/portfolios',
   bybitDemo: '/api/bybit/demo/portfolios'
}

export const portfolioRoutes: Record<string, (params?: Body) => unknown> = Object.fromEntries(
   (Object.entries(bases) as [VenueId, string][]).flatMap(([venue, base]) => [
      [`${base}/overview`, () => overview(venue)],
      [`${base}/markets`, () => markets()],
      [`${base}/save`, (params?: Body) => save(venue, arg(params))],
      [`${base}/archive`, (params?: Body) => archive(venue, arg(params))],
      [`${base}/deposit`, (params?: Body) => deposit(venue, arg(params))],
      [`${base}/adjust`, (params?: Body) => adjust(venue, arg(params))],
      [`${base}/plan`, (params?: Body) => plan(venue, arg(params))],
      [`${base}/execute`, (params?: Body) => execute(venue, arg(params))],
      [`${base}/run`, (params?: Body) => run(venue, arg(params))],
      [`${base}/history`, (params?: Body) => history(venue, arg(params))]
   ]))

export interface VideoControls {
   prices: Record<string, number>
   overview: () => PortfolioOverviewResponse
   movePrices: (factors: Record<string, number>) => void
   advanceDays: (days: number) => void
}

declare global {
   interface Window {
      __video: VideoControls
   }
}

const controls: VideoControls = {
   prices,
   overview: () => overview('bybit'),
   movePrices: factors => {
      for (const [asset, factor] of Object.entries(factors)) prices[asset] = Number(((prices[asset] ?? 0) * factor).toPrecision(4))
   },
   advanceDays: days => { clockOffset += days * 86400000 }
}

window.__video = controls
