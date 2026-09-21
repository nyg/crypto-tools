import type {
   AccountCoin, PortfolioArchiveRequest, PortfolioArchiveResponse, PortfolioExecuteRequest,
   PortfolioHistoryRequest, PortfolioHistoryResponse, PortfolioHolding, PortfolioMarketsResponse,
   PortfolioMovement, PortfolioMovementRequest, PortfolioMovementResponse, PortfolioOverviewResponse,
   PortfolioPlanOrder, PortfolioPlanRequest, PortfolioPlanResponse, PortfolioRun, PortfolioRunRequest,
   PortfolioRunResponse, PortfolioSaveRequest, PortfolioSaveResponse, PortfolioStopAckRequest,
   PortfolioStopAckResponse, PortfolioStopFill, PortfolioStopState, PortfolioStopSyncRequest,
   PortfolioStopSyncResponse, PortfolioSummary, PortfolioTarget
} from '../../types/api'
import type { VenueId } from '../../types/portfolio'

const prices: Record<string, number> = {
   USD: 1, EUR: 1.08, USDT: 1, USDC: 1, BTC: 64250, ETH: 3120, SOL: 152.4, SUI: 3.18, TAO: 418, ENA: 0.92, DOGE: 0.14, XRP: 0.58
}

const FEE_RATE = 0.001
const MIN_ORDER = 5

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
   stops: PortfolioStopState[]
   deposited?: number
}

interface MockPlan {
   portfolioId: number
   orders: PortfolioPlanOrder[]
   withdraw: number
   all: boolean
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
   stopFills: PortfolioStopFill[]
   nextId: number
}

const DAY = 86400000

const STABLECOINS = ['USDT', 'USDC']

const quoteAssets: Record<VenueId, string[]> = {
   bybit: STABLECOINS,
   bybitDemo: STABLECOINS,
   kraken: ['USD', 'EUR', ...STABLECOINS],
   binance: STABLECOINS,
   binanceTestnet: STABLECOINS
}

const cashOf = (venue: VenueId) => quoteAssets[venue][0] ?? 'USDT'

const isLive = (venue: VenueId) => venue !== 'bybitDemo' && venue !== 'binanceTestnet'

function seed(venue: VenueId): VenueState {
   const created = Date.now() - 40 * DAY
   const cash = cashOf(venue)
   const portfolios: MockPortfolio[] = isLive(venue)
      ? [
         {
            id: 1, name: 'Core', quoteAsset: cash, band: '1', createdAt: created,
            targets: [
               { asset: 'BTC', weight: '50', stopPrice: '58000' },
               { asset: 'ETH', weight: '30', stopPrice: null },
               { asset: cash, weight: '20', stopPrice: null }
            ],
            holdings: { BTC: 0.0712, ETH: 0.84, [cash]: 1480 },
            costs: { BTC: 3900, ETH: 2750 },
            realized: { BTC: 820, ETH: 310 },
            closedRealized: 0,
            stops: [{
               orderLinkId: 'pf1-stpa1b2c3d4', asset: 'BTC', symbol: `BTC${cash}`, quantity: '0.0712',
               triggerPrice: '58000', status: 'placed', error: null, placedAt: created + 30 * DAY
            }],
            deposited: 7000
         },
         {
            id: 2, name: 'Alts', quoteAsset: cash, band: '2', createdAt: created + 5 * DAY,
            targets: [
               { asset: 'SOL', weight: '40', stopPrice: '120' },
               { asset: 'SUI', weight: '30', stopPrice: null },
               { asset: 'ENA', weight: '30', stopPrice: null }
            ],
            holdings: { SOL: 6.1, SUI: 240, ENA: 1150, [cash]: 12.4 },
            costs: { SOL: 980, SUI: 610, ENA: 1010 },
            realized: { SOL: 40 },
            closedRealized: 72.4,
            stops: [{
               orderLinkId: 'pf2-stp9f8e7d6c', asset: 'SOL', symbol: `SOL${cash}`, quantity: '6.1',
               triggerPrice: '120', status: 'placed', error: null, placedAt: created + 32 * DAY
            }],
            deposited: 2500
         }
      ]
      : [
         {
            id: 1, name: 'Demo core', quoteAsset: cash, band: '1', createdAt: created,
            targets: [
               { asset: 'BTC', weight: '60', stopPrice: null },
               { asset: 'ETH', weight: '40', stopPrice: null }
            ],
            holdings: { [cash]: 1000 },
            costs: {},
            realized: {},
            closedRealized: 0,
            stops: [],
            deposited: 1000
         }
      ]

   const movements = new Map<number, PortfolioMovement[]>(portfolios.map(portfolio => [portfolio.id, [{
      id: portfolio.id, kind: 'deposit', asset: cash, amount: String(portfolio.deposited),
      value: String(portfolio.deposited), orderLinkId: null, note: '', createdAt: portfolio.createdAt
   }]]))

   return {
      wallet: isLive(venue)
         ? { [cash]: 3890.25, BTC: 0.0812, ETH: 0.84, SOL: 6.1, SUI: 240, ENA: 1150, USDC: 250, DOGE: 1200 }
         : { [cash]: 50000, BTC: 1, ETH: 10 },
      portfolios,
      movements,
      runs: new Map(),
      plans: new Map(),
      stopFills: isLive(venue)
         ? [{
            orderLinkId: 'pf2-stp5a4b3c2d', portfolioId: 2, portfolioName: 'Alts', asset: 'XRP',
            quantity: '420', proceeds: '243.6', averagePrice: '0.58', settledAt: Date.now() - 2 * DAY
         }]
         : [],
      nextId: 10
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
      const stop = portfolio.stops.find(entry => entry.asset === asset)
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
         stopStatus: stop?.status ?? null
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
      stops: portfolio.stops
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
         const unallocated = wallet - assigned
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
      accountId: isLive(venue) ? '100200300' : '900800700',
      key: { canTrade: true, expiresAt: venue === 'bybit' ? Date.now() + 9 * DAY : null },
      valuationAsset: cashOf(venue),
      coins,
      totalValue: fixed(Object.entries(state.wallet).reduce((sum, [asset, amount]) => sum + amount * (prices[asset] ?? 0), 0), 2),
      unallocatedValue: fixed(coins.reduce((sum, coin) => sum + Math.max(0, coin.valueNum), 0), 2),
      portfolios: state.portfolios.map(portfolio => summarize(state, portfolio)),
      activeRun: activeRun ? { id: activeRun.id, portfolioId: activeRun.portfolioId } : null,
      reconciled: 0,
      hardStops: true,
      stopsSyncing: false,
      stopFills: state.stopFills
   }
}

const markets = (venue: VenueId): PortfolioMarketsResponse => ({
   quoteAssets: quoteAssets[venue],
   markets: Object.keys(prices)
      .filter(asset => !quoteAssets[venue].includes(asset))
      .flatMap(base => quoteAssets[venue].map(quote => ({ symbol: `${base}${quote}`, base, quote })))
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
      createdAt: Date.now(), targets: request.targets, holdings: {}, costs: {}, realized: {},
      closedRealized: 0, stops: []
   })
   return { id }
}

function syncStops(venue: VenueId, request?: PortfolioStopSyncRequest): PortfolioStopSyncResponse | Promise<never> {

   const state = stateOf(venue)
   const portfolio = state.portfolios.find(({ id }) => id === request?.portfolioId)
   if (!portfolio) return reject('This portfolio does not exist.')

   portfolio.stops = portfolio.targets
      .filter(({ asset, stopPrice }) => stopPrice !== null && asset !== portfolio.quoteAsset)
      .map(({ asset, stopPrice }) => ({
         orderLinkId: portfolio.stops.find(stop => stop.asset === asset)?.orderLinkId
            ?? `pf${portfolio.id}-stp${Math.random().toString(16).slice(2, 10)}`,
         asset,
         symbol: `${asset}${portfolio.quoteAsset}`,
         quantity: fixed(portfolio.holdings[asset] ?? 0),
         triggerPrice: stopPrice!,
         status: 'placed' as const,
         error: null,
         placedAt: Date.now()
      }))

   return { stops: portfolio.stops, skipped: [] }
}

function ackStop(venue: VenueId, request?: PortfolioStopAckRequest): PortfolioStopAckResponse {
   const state = stateOf(venue)
   const before = state.stopFills.length
   state.stopFills = state.stopFills.filter(({ orderLinkId }) => orderLinkId !== request?.orderLinkId)
   return { acknowledged: before - state.stopFills.length }
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
   const entry = { ...movement, id: state.nextId++, createdAt: Date.now() }
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

function plan(venue: VenueId, request?: PortfolioPlanRequest): PortfolioPlanResponse | Promise<never> {
   const state = stateOf(venue)
   const portfolio = state.portfolios.find(({ id }) => id === request?.portfolioId)
   if (!portfolio || !request) return reject('This portfolio does not exist.')

   const quote = portfolio.quoteAsset
   const total = valueOf(portfolio)
   const withdraw = request.kind === 'withdraw' ? (request.all ? total : Number(request.amount)) : 0
   if (withdraw > total) return reject(`Cannot withdraw more than the portfolio is worth (${fixed(total, 2)} ${quote}).`)

   const band = Number(request.band ?? portfolio.band)
   const investable = total - withdraw
   const cash = portfolio.holdings[quote] ?? 0
   const weights = new Map(portfolio.targets.map(({ asset, weight }) => [asset, Number(weight)]))
   const assets = [...new Set([...weights.keys(), ...Object.keys(portfolio.holdings)])].filter(asset => asset !== quote)
   const cashDrift = total > 0 ? cash * (prices[quote] ?? 1) / total * 100 - (weights.get(quote) ?? 0) : 0

   const orders: PortfolioPlanOrder[] = []
   const skipped: PortfolioPlanResponse['skipped'] = []

   for (const asset of assets) {
      const price = prices[asset] ?? 0
      const value = (portfolio.holdings[asset] ?? 0) * price
      const target = (weights.get(asset) ?? 0) / 100 * investable
      const drift = total > 0 ? value / total * 100 - (weights.get(asset) ?? 0) : 0
      const delta = target - value

      if (request.kind === 'withdraw' && (cash >= withdraw || delta >= 0)) continue
      const absorbsCash = (cashDrift > band && delta > 0) || (cashDrift < -band && delta < 0)
      if (request.kind === 'rebalance' && weights.has(asset) && Math.abs(drift) <= band && !absorbsCash) {
         if (drift !== 0) skipped.push({ asset, reason: 'within-band', value: fixed(Math.abs(delta), 2) })
         continue
      }
      if (Math.abs(delta) < MIN_ORDER) {
         if (Math.abs(delta) > 0) skipped.push({ asset, reason: 'below-minimum', value: fixed(Math.abs(delta), 2) })
         continue
      }

      orders.push(delta < 0
         ? { asset, symbol: `${asset}${quote}`, side: 'sell', unit: 'base', amount: fixed(-delta / price, 6), price: String(price), value: fixed(-delta, 2) }
         : { asset, symbol: `${asset}${quote}`, side: 'buy', unit: 'quote', amount: fixed(delta, 2), price: String(price), value: fixed(delta, 2) })
   }

   orders.sort((left, right) => (left.side === right.side ? 0 : left.side === 'sell' ? -1 : 1))

   const planId = `mock-plan-${state.nextId++}`
   state.plans.set(planId, { portfolioId: portfolio.id, orders, withdraw, all: Boolean(request.all) })

   const traded = orders.reduce((sum, order) => sum + (order.side === 'sell' ? 1 : -1) * Number(order.value), 0)

   return {
      planId,
      portfolioId: portfolio.id,
      venue,
      kind: request.kind,
      quoteAsset: quote,
      expiresAt: Date.now() + 120000,
      band: String(band),
      slippage: request.slippage ?? '1',
      total: fixed(total, 2),
      withdraw: fixed(withdraw, 2),
      orders,
      skipped,
      cashAfter: fixed(cash + traded - withdraw, 2),
      shortfall: '0',
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
   const id = `mock-run-${state.nextId++}`
   const run: PortfolioRun = {
      id,
      portfolioId: portfolio.id,
      kind: stored.withdraw > 0 ? 'withdraw' : 'rebalance',
      status: 'running',
      running: true,
      withdraw: fixed(stored.withdraw, 2),
      withdrawn: '0',
      startedAt: Date.now(),
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
      fees: [{ asset: buy ? base : portfolio.quoteAsset, amount: fixed(fee) }]
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
      if (next && entry.polls > 1) fill(state, portfolio, next)
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
         Object.assign(current, { status: 'done', running: false, finishedAt: Date.now() })
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

const bases: Record<VenueId, string> = {
   bybit: '/api/bybit/portfolios',
   bybitDemo: '/api/bybit/demo/portfolios',
   kraken: '/api/kraken/portfolios',
   binance: '/api/binance/portfolios',
   binanceTestnet: '/api/binance/testnet/portfolios'
}

export const portfolioRoutes: Record<string, (params?: Body) => unknown> = Object.fromEntries(
   (Object.entries(bases) as [VenueId, string][]).flatMap(([venue, base]) => [
      [`${base}/overview`, () => overview(venue)],
      [`${base}/markets`, () => markets(venue)],
      [`${base}/save`, (params?: Body) => save(venue, arg(params))],
      [`${base}/archive`, (params?: Body) => archive(venue, arg(params))],
      [`${base}/deposit`, (params?: Body) => deposit(venue, arg(params))],
      [`${base}/adjust`, (params?: Body) => adjust(venue, arg(params))],
      [`${base}/plan`, (params?: Body) => plan(venue, arg(params))],
      [`${base}/execute`, (params?: Body) => execute(venue, arg(params))],
      [`${base}/run`, (params?: Body) => run(venue, arg(params))],
      [`${base}/stops/sync`, (params?: Body) => syncStops(venue, arg(params))],
      [`${base}/stops/ack`, (params?: Body) => ackStop(venue, arg(params))],
      [`${base}/history`, (params?: Body) => history(venue, arg(params))]
   ]))
