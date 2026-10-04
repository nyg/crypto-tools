import Big from 'big.js'
import { randomUUID } from 'crypto'
import PortfolioRepository from '../../db/portfolio-repository'
import { HttpRequesterError, messageOf } from '../../errors'
import { foldHoldings, sameHoldings } from './holdings'
import { leftBehind, limitFits, limitQuantity, priceBound, restingPrice } from './limit-orders'
import { buyCost, buyFits, buyScale, DEFAULT_FEE_RATE, feeRateOf, floorTo, orderFee, planPortfolio } from './planner'
import { foldPositions } from './positions'
import { planStops, stopActions } from './stops'
import { supertrend } from './supertrend'
import { moveWeightToCash, validateTargets } from './targets'
import type { PortfolioExchange } from './exchange'
import type { FeeRate, PlanMarket, PlannedOrder } from './planner'
import type { LiveStop } from './stops'
import type { Supertrend } from './supertrend'
import type { TargetWeight } from './targets'
import type { Venue } from './venues'
import type { RequestBody } from '../../routes/with-account'
import type { FeeDraft, OrderDraft } from '../../db/portfolio-repository'
import type { PortfolioRunOrder } from '../../../types/api'
import type {
   PortfolioMovementRow, PortfolioOrderRow, PortfolioRow, PortfolioStopRow, PortfolioTargetRow
} from '../../../types/db'
import type {
   AccountCoin, PortfolioArchiveResponse, PortfolioHistoryResponse, PortfolioHolding,
   PortfolioMarketsResponse, PortfolioMovement, PortfolioMovementResponse,
   PortfolioOverviewResponse, PortfolioPlanResponse, PortfolioRun, PortfolioRunResponse,
   PortfolioSaveResponse, PortfolioStopAckResponse, PortfolioStopFill, PortfolioStopState,
   PortfolioStopSyncResponse, PortfolioSummary, PortfolioSupertrendResponse, SupertrendLevel, SupertrendLevels
} from '../../../types/api'
import type {
   CandleInterval, ExchangeAccount, Execution, FeeAmount, OrderLookup, OrderSettlement, RebalanceMode, RunKind,
   RunOrderStatus, RunStatus, SpotMarket, SpotPrice, TradeFees, VenueId, WalletCoin
} from '../../../types/portfolio'

export type PortfolioErrorStatus = 400 | 403 | 404 | 409 | 410

export class PortfolioError extends Error {
   readonly status: PortfolioErrorStatus

   constructor(status: PortfolioErrorStatus, message: string) {
      super(message)
      this.name = 'PortfolioError'
      this.status = status
   }
}

interface StoredPlan {
   id: string
   venue: VenueId
   accountId: string
   portfolioId: number
   kind: RunKind
   quote: string
   withdraw: Big
   withdrawAll: boolean
   reserve: Big
   feeRates: Map<string, FeeRate>
   slippage: string
   execution: Execution
   wait: string
   orders: PlannedOrder[]
   markets: Map<string, PlanMarket>
   holdings: Map<string, Big>
   expiresAt: number
}

interface Context {
   account: ExchangeAccount
   repository: PortfolioRepository
   lockKey: string
}

interface Chase {
   runId: string
   market: PlanMarket
   bound: Big
   deadline: number
   wait: string
}

interface Rested {
   settlement: OrderSettlement | null
   note: string | null
   again: boolean
}

const PLAN_TTL_MS = 2 * 60 * 1000
const DEFAULT_SLIPPAGE = '1'
const DEFAULT_WAIT_SECONDS = '120'
const MAX_REFUSALS = 5
const MAX_CANCEL_FAILURES = 5
const REACHED_ATTEMPTS = 4
const SETTLE_ATTEMPTS = 20
const SETTLE_DELAY_MS = 500
const FEE_GRACE_ATTEMPTS = 6
const STOP_RETRY_MS = 15 * 60 * 1000

const plans = new Map<string, StoredPlan>()
const busyAccounts = new Set<string>()
const liveRuns = new Set<string>()
const stoppedRuns = new Set<string>()
const stopSyncs = new Set<string>()
const stopChains = new Map<string, Promise<unknown>>()

const ZERO = Big(0)
const HUNDRED = Big(100)

const STOPPED = 'The run was stopped.'
const MOVED = 'Moved with the price.'
const WOULD_TAKE = 'It would have filled as a taker.'
const TOO_SMALL = 'What is left is below the minimum order size.'

const IN_FLIGHT: RunOrderStatus[] = ['pending', 'placed', 'unknown']

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const decimal = (value: Big, places = 8) => value.round(places).toFixed()

const percentOf = (part: Big, whole: Big) => decimal(part.div(whole).times(HUNDRED), 4)

const levelOf = (level: Supertrend | null): SupertrendLevel | null =>
   level && { flipPrice: decimal(level.flipPrice), trend: level.trend }

const minOf = (left: Big, right: Big) => left.lt(right) ? left : right

const feesOf = ({ fees }: OrderSettlement): FeeDraft[] =>
   Object.entries(fees).map(([asset, amount]) => ({ asset, amount }))

function parseDecimal(value: unknown, label: string): Big {
   try {
      return Big(String(value ?? '').trim().replace(/[,\s']/g, ''))
   }
   catch {
      throw new PortfolioError(400, `${label} is not a number.`)
   }
}

function parsePositive(value: unknown, label: string): Big {
   const parsed = parseDecimal(value, label)
   if (parsed.lte(0)) throw new PortfolioError(400, `${label} must be above zero.`)
   return parsed
}

function parseRange(value: unknown, label: string, min: number, max: number): Big {
   const parsed = parseDecimal(value, label)
   if (parsed.lt(min) || parsed.gt(max)) throw new PortfolioError(400, `${label} must be between ${min} and ${max}.`)
   return parsed
}

function parseId(value: unknown): number {
   const id = Number(value)
   if (!Number.isSafeInteger(id) || id <= 0) throw new PortfolioError(400, 'No portfolio was given.')
   return id
}

const assetOf = (value: unknown) => String(value ?? '').trim().toUpperCase()

const rebalanceModes: RebalanceMode[] = ['full', 'invest', 'trim']

function parseMode(value: unknown): RebalanceMode {
   if (value === undefined || value === null || value === '') return 'full'
   const mode = rebalanceModes.find(known => known === value)
   if (!mode) throw new PortfolioError(400, `"${String(value)}" is not a way to rebalance.`)
   return mode
}

const executions: Execution[] = ['limit', 'market']

function parseExecution(value: unknown): Execution {
   if (value === undefined || value === null || value === '') return 'limit'
   const execution = executions.find(known => known === value)
   if (!execution) throw new PortfolioError(400, `"${String(value)}" is not a way to place orders.`)
   return execution
}

const parseExclude = (value: unknown): Set<string> =>
   new Set(Array.isArray(value) ? value.filter(asset => typeof asset === 'string').map(assetOf) : [])

function priceIn(prices: Record<string, SpotPrice>, asset: string, quote: string): Big | null {
   if (asset === quote) return Big(1)
   const direct = prices[`${asset}${quote}`]
   if (direct && Big(direct.last || 0).gt(0)) return Big(direct.last)
   const inverse = prices[`${quote}${asset}`]
   if (inverse && Big(inverse.last || 0).gt(0)) return Big(1).div(inverse.last)
   return null
}

function planMarkets(markets: SpotMarket[], prices: Record<string, SpotPrice>, quote: string): Map<string, PlanMarket> {
   return new Map(markets
      .filter(market => market.quote === quote)
      .map(market => {
         const price = prices[market.symbol]
         const last = Big(price?.last || 0)
         return [market.base, {
            symbol: market.symbol,
            base: market.base,
            quote: market.quote,
            last,
            bid: Big(price?.bid || last),
            ask: Big(price?.ask || last),
            baseStep: Big(market.baseStep || 0),
            quoteStep: Big(market.quoteStep || 0),
            tickStep: Big(market.tickStep || 0),
            minQty: Big(market.minQty || 0),
            minAmount: Big(market.minAmount || 0),
            maxQty: Big(market.maxQty || 0),
            maxAmount: Big(market.maxAmount || 0)
         }]
      }))
}

function groupBy<T>(rows: T[], key: (row: T) => number): Map<number, T[]> {
   const groups = new Map<number, T[]>()
   for (const row of rows) groups.set(key(row), [...groups.get(key(row)) ?? [], row])
   return groups
}

const movementView = ({ id, kind, asset, amount, value, orderLinkId, note, createdAt }: PortfolioMovementRow): PortfolioMovement =>
   ({ id, kind, asset, amount, value, orderLinkId, note, createdAt })

const stopView = ({ orderLinkId, asset, symbol, quantity, triggerPrice, status, error, placedAt }: PortfolioStopRow): PortfolioStopState =>
   ({ orderLinkId, asset, symbol, quantity, triggerPrice, status, error, placedAt })

const isLiveStop = ({ status }: PortfolioStopRow) => status === 'pending' || status === 'placed'

const lookupOf = ({ symbol, orderLinkId, orderId }: PortfolioOrderRow | PortfolioStopRow): OrderLookup =>
   ({ symbol, clientOrderId: orderLinkId, orderId })

const executed = ({ base }: OrderSettlement | PortfolioOrderRow) => Big(base || 0).gt(0)

const filledIn = (order: PortfolioOrderRow, settlement: OrderSettlement | null) =>
   Big((order.unit === 'base' ? settlement?.base : settlement?.quote) || 0)

const attemptStatus = (settlement: OrderSettlement): RunOrderStatus =>
   settlement.status === 'filled' ? 'filled' : executed(settlement) ? 'partial' : 'cancelled'

function attemptsBySeq(orders: PortfolioOrderRow[]): PortfolioOrderRow[][] {
   const attempts = new Map<number, PortfolioOrderRow[]>()
   for (const order of orders) attempts.set(order.seq, [...attempts.get(order.seq) ?? [], order])
   return [...attempts.values()]
}

function statusOf(attempts: PortfolioOrderRow[]): RunOrderStatus {
   const last = attempts.at(-1)!
   const flying = attempts.find(({ status }) => IN_FLIGHT.includes(status))
   if (flying) return flying.status
   if (last.status === 'filled' || attempts.length === 1) return last.status
   return attempts.some(executed) ? 'partial' : last.status
}

function mergedFees(attempts: PortfolioOrderRow[], fees: Map<string, FeeAmount[]>): FeeAmount[] {
   const totals = new Map<string, Big>()
   for (const { asset, amount } of attempts.flatMap(({ orderLinkId }) => fees.get(orderLinkId) ?? [])) {
      totals.set(asset, (totals.get(asset) ?? ZERO).plus(amount))
   }
   return [...totals].map(([asset, amount]) => ({ asset, amount: amount.toFixed() }))
}

function orderView(attempts: PortfolioOrderRow[], fees: Map<string, FeeAmount[]>): PortfolioRunOrder {

   const first = attempts[0]!
   const last = attempts.at(-1)!
   const base = attempts.reduce((sum, order) => sum.plus(order.base || 0), ZERO)
   const quote = attempts.reduce((sum, order) => sum.plus(order.quote || 0), ZERO)
   const status = statusOf(attempts)
   const averagePrice = attempts.length === 1 ? first.averagePrice
      : base.gt(0) ? quote.div(base).round(12).toFixed() : '0'

   return {
      orderLinkId: first.orderLinkId,
      seq: first.seq,
      symbol: first.symbol,
      side: first.side,
      unit: first.unit,
      requested: first.requested,
      status,
      base: base.toFixed(),
      quote: quote.toFixed(),
      averagePrice,
      limitPrice: last.limitPrice,
      attempts: attempts.length,
      fees: mergedFees(attempts, fees),
      error: status === 'filled' ? null : last.error
   }
}

function shownStops(stops: PortfolioStopRow[]): PortfolioStopRow[] {

   const live = stops.filter(isLiveStop)
   const covered = new Set(live.map(({ asset }) => asset))
   const broken = new Map<string, PortfolioStopRow>()

   for (const stop of stops) {
      if (stop.status !== 'failed' && stop.status !== 'missing') continue
      if (covered.has(stop.asset)) continue
      const known = broken.get(stop.asset)
      if (!known || known.updatedAt <= stop.updatedAt) broken.set(stop.asset, stop)
   }

   return [...live, ...broken.values()]
}

const liveStopsOf = (stops: PortfolioStopRow[]): LiveStop[] =>
   stops.map(({ orderLinkId, asset, symbol, quantity, triggerPrice }) =>
      ({ orderLinkId, asset, symbol, quantity: Big(quantity), triggerPrice: Big(triggerPrice) }))

const targetWeights = (targets: PortfolioTargetRow[]): TargetWeight[] =>
   targets.map(({ asset, weight, stopPrice }) => ({ asset, weight, stopPrice }))

function serialized<T>(key: string, task: () => Promise<T>): Promise<T> {
   const next = (stopChains.get(key) ?? Promise.resolve()).catch(() => {}).then(task)
   stopChains.set(key, next.catch(() => {}))
   return next
}

function purgeExpiredPlans(now = Date.now()) {
   for (const [id, plan] of plans) {
      if (plan.expiresAt < now) plans.delete(id)
   }
}

export default class PortfolioService {

   readonly #venue: Venue
   readonly #exchange: PortfolioExchange

   constructor(venue: Venue, exchange: PortfolioExchange) {
      this.#venue = venue
      this.#exchange = exchange
   }

   #describe(error: unknown): string {
      return error instanceof HttpRequesterError ? this.#exchange.describeError(error) : messageOf(error)
   }

   #isRejection(error: unknown): boolean {
      return error instanceof HttpRequesterError && error.statusCode < 500 && !this.#exchange.isAmbiguous(error)
   }

   async #tradeFees(symbols: string[]): Promise<Record<string, TradeFees>> {
      if (!this.#exchange.tradeFees || symbols.length === 0) return {}
      try {
         return await this.#exchange.tradeFees(symbols)
      }
      catch (error) {
         console.warn('Could not read the fee rates, assuming the default:', this.#describe(error))
         return {}
      }
   }

   async #context(): Promise<Context> {
      const account = await this.#exchange.account()
      return {
         account,
         repository: new PortfolioRepository(this.#venue.id, account.accountId),
         lockKey: `${this.#venue.id}:${account.accountId}`
      }
   }

   #requirePortfolio(repository: PortfolioRepository, value: unknown): PortfolioRow {
      const portfolio = repository.portfolio(parseId(value))
      if (!portfolio) throw new PortfolioError(404, 'This portfolio does not exist.')
      return portfolio
   }

   #holdings(repository: PortfolioRepository): Map<number, Map<string, Big>> {
      const movements = groupBy(repository.movements(), row => row.portfolioId)
      const orders = groupBy(repository.orders(), row => row.portfolioId)
      const ids = new Set([...movements.keys(), ...orders.keys()])
      const decimals = this.#exchange.balanceDecimals
      return new Map([...ids].map(id => [id, foldHoldings(movements.get(id) ?? [], orders.get(id) ?? [], decimals)]))
   }

   #holdingsOf(repository: PortfolioRepository, portfolioId: number): Map<string, Big> {
      return this.#holdings(repository).get(portfolioId) ?? new Map()
   }

   async overview(): Promise<PortfolioOverviewResponse> {

      const { account, repository, lockKey } = await this.#context()
      const reconciled = await this.#reconcile(repository)
      const [wallet, markets, prices] = await Promise.all([
         this.#exchange.wallet(), this.#exchange.markets(), this.#exchange.prices()])

      const holdings = this.#holdings(repository)
      const targets = groupBy(repository.targets(), row => row.portfolioId)
      const movements = groupBy(repository.movements(), row => row.portfolioId)
      const orders = groupBy(repository.orders(), row => row.portfolioId)
      const stops = groupBy(repository.stops(), row => row.portfolioId)
      const lastRebalances = repository.lastRebalances()

      const rows = repository.portfolios()
      const portfolios = rows.map(portfolio => this.#summarize(
         repository, portfolio, targets.get(portfolio.id) ?? [], holdings.get(portfolio.id) ?? new Map(),
         movements.get(portfolio.id) ?? [], orders.get(portfolio.id) ?? [],
         shownStops(stops.get(portfolio.id) ?? []), prices, lastRebalances.get(portfolio.id) ?? null))

      const drifted = rows.filter(portfolio => this.#stopsDrifted(
         portfolio, targets.get(portfolio.id) ?? [], holdings.get(portfolio.id) ?? new Map(),
         stops.get(portfolio.id) ?? [], markets, prices))

      const { coins, totalValue, unallocatedValue } = this.#coins(wallet, [...holdings.values()], prices)
      const activeRun = repository.runningRuns().find(run => liveRuns.has(run.id))

      return {
         fetchedAt: Date.now(),
         venue: this.#venue.id,
         accountId: account.accountId,
         key: { canTrade: account.canTrade, expiresAt: account.expiresAt },
         valuationAsset: this.#venue.valuationAsset,
         coins,
         totalValue: decimal(totalValue, 2),
         unallocatedValue: decimal(unallocatedValue, 2),
         portfolios,
         activeRun: activeRun ? { id: activeRun.id, portfolioId: activeRun.portfolioId } : null,
         reconciled,
         hardStops: this.#venue.hardStops,
         stopsSyncing: this.#syncStopsDetached(lockKey, repository, drifted.map(({ id }) => id)),
         stopFills: this.#stopFills(repository, rows)
      }
   }

   #stopFills(repository: PortfolioRepository, portfolios: PortfolioRow[]): PortfolioStopFill[] {
      const names = new Map(portfolios.map(({ id, name }) => [id, name]))
      return repository.unacknowledgedStops().map(stop => {
         const order = repository.order(stop.orderLinkId)
         return {
            orderLinkId: stop.orderLinkId,
            portfolioId: stop.portfolioId,
            portfolioName: names.get(stop.portfolioId) ?? '',
            asset: stop.asset,
            quantity: order?.base ?? stop.quantity,
            proceeds: order?.quote ?? '0',
            averagePrice: order?.averagePrice ?? stop.triggerPrice,
            settledAt: stop.settledAt
         }
      })
   }

   #summarize(
      repository: PortfolioRepository, portfolio: PortfolioRow, targets: PortfolioTargetRow[],
      holdings: Map<string, Big>, movements: PortfolioMovementRow[], orders: PortfolioOrderRow[],
      stops: PortfolioStopRow[], prices: Record<string, SpotPrice>, lastRebalancedAt: number | null
   ): PortfolioSummary {

      const quote = portfolio.quoteAsset
      const positions = foldPositions(quote, movements, orders)
      const weights = new Map(targets.map(({ asset, weight }) => [asset, Big(weight)]))
      const stopPrices = new Map(targets.map(({ asset, stopPrice }) => [asset, stopPrice]))
      const stopStates = new Map(stops.map(stop => [stop.asset, stop]))
      const others = [...holdings.keys()].filter(asset => !weights.has(asset))
      const assets = [...weights.keys(), ...others]

      const valued = assets.map(asset => {
         const quantity = holdings.get(asset) ?? ZERO
         const price = priceIn(prices, asset, quote)
         return { asset, quantity, price, value: price ? quantity.times(price) : null }
      })

      const total = valued.reduce((sum, { value }) => sum.plus(value ?? ZERO), ZERO)

      let openCost = ZERO

      const rows: PortfolioHolding[] = valued.map(({ asset, quantity, price, value }) => {
         const target = weights.get(asset) ?? ZERO
         const weight = value && total.gt(0) ? value.div(total).times(HUNDRED) : null
         const position = asset === quote ? null : positions.coins.get(asset) ?? null
         const realized = asset === quote ? positions.cashRealized : position?.realized ?? ZERO
         const cost = value && position ? position.cost : null
         const unrealized = value && cost ? value.minus(cost) : null
         const disposedCost = position?.disposedCost ?? ZERO
         if (cost) openCost = openCost.plus(cost)
         return {
            asset,
            quantity: quantity.toFixed(),
            price: price ? price.toFixed() : null,
            value: value ? decimal(value) : null,
            valueNum: value ? value.toNumber() : 0,
            weight: weight ? decimal(weight, 4) : null,
            target: target.toFixed(),
            drift: weight ? decimal(weight.minus(target), 4) : null,
            unrealized: unrealized ? decimal(unrealized) : null,
            unrealizedPercent: unrealized && cost?.gt(0) ? percentOf(unrealized, cost) : null,
            realized: decimal(realized),
            realizedPercent: disposedCost.gt(0) ? percentOf(realized, disposedCost) : null,
            stopPrice: stopPrices.get(asset) ?? null,
            stopStatus: stopStates.get(asset)?.status ?? null
         }
      })

      const listed = new Set(assets)
      const realizedTotal = [...positions.coins].reduce((sum, [asset, position]) =>
         sum.plus(position.realized).minus(listed.has(asset) ? ZERO : position.cost), positions.cashRealized)
      const unrealizedTotal = rows.reduce((sum, row) => sum.plus(row.unrealized ?? ZERO), ZERO)
      const realizedInRows = rows.reduce((sum, row) => sum.plus(row.realized), ZERO)
      const closedCost = [...positions.coins].reduce((sum, [asset, position]) =>
         sum.plus(position.disposedCost).plus(listed.has(asset) ? ZERO : position.cost), ZERO)
      const unlistedCost = [...positions.coins].reduce((sum, [asset, position]) =>
         listed.has(asset) ? sum : sum.plus(position.disposedCost).plus(position.cost), ZERO)
      const closedRealized = realizedTotal.minus(realizedInRows)

      const maxDrift = rows.reduce((max, { drift }) => {
         const absolute = drift ? Big(drift).abs() : ZERO
         return absolute.gt(max) ? absolute : max
      }, ZERO)

      const netInvested = movements.reduce((sum, { kind, value }) => {
         if (kind === 'deposit') return sum.plus(value)
         if (kind === 'withdraw') return sum.minus(value)
         return sum
      }, ZERO)

      return {
         id: portfolio.id,
         name: portfolio.name,
         quoteAsset: quote,
         band: portfolio.band,
         createdAt: portfolio.createdAt,
         targets: targetWeights(targets),
         holdings: rows,
         value: decimal(total),
         valueNum: total.toNumber(),
         netInvested: decimal(netInvested),
         profit: decimal(total.minus(netInvested)),
         realized: decimal(realizedTotal),
         realizedPercent: closedCost.gt(0) ? percentOf(realizedTotal, closedCost) : null,
         unrealized: decimal(unrealizedTotal),
         unrealizedPercent: openCost.gt(0) ? percentOf(unrealizedTotal, openCost) : null,
         closedRealized: decimal(closedRealized),
         closedRealizedPercent: unlistedCost.gt(0) ? percentOf(closedRealized, unlistedCost) : null,
         fees: decimal(positions.fees),
         feesUnvalued: [...positions.unvaluedFees],
         maxDrift: decimal(maxDrift, 4),
         needsRebalance: total.gt(0) && maxDrift.gt(portfolio.band),
         lastRebalancedAt,
         quoteLocked: repository.hasActivity(portfolio.id),
         stops: stops.map(stopView)
      }
   }

   #coins(wallet: WalletCoin[], holdings: Map<string, Big>[], prices: Record<string, SpotPrice>) {

      const allocated = new Map<string, Big>()
      for (const portfolio of holdings) {
         for (const [asset, amount] of portfolio) allocated.set(asset, (allocated.get(asset) ?? ZERO).plus(amount))
      }

      const walletOf = new Map(wallet.map(coin => [coin.asset, coin]))
      const assets = [...new Set([...walletOf.keys(), ...allocated.keys()])]

      let totalValue = ZERO
      let unallocatedValue = ZERO

      const coins: AccountCoin[] = assets.map(asset => {
         const coin = walletOf.get(asset)
         const total = Big(coin?.total || 0)
         const assigned = allocated.get(asset) ?? ZERO
         const unallocated = total.minus(coin?.borrowed || 0).minus(assigned)
         const price = priceIn(prices, asset, this.#venue.valuationAsset)
         const value = price ? unallocated.times(price) : null

         if (price) totalValue = totalValue.plus(total.times(price))
         if (value?.gt(0)) unallocatedValue = unallocatedValue.plus(value)

         return {
            asset,
            wallet: total.toFixed(),
            free: Big(coin?.free || 0).toFixed(),
            allocated: assigned.toFixed(),
            unallocated: unallocated.toFixed(),
            value: value ? decimal(value, 2) : null,
            valueNum: value ? value.toNumber() : 0,
            overallocated: unallocated.lt(0)
         }
      })
         .filter(coin => !Big(coin.wallet).eq(0) || !Big(coin.allocated).eq(0))
         .sort((left, right) => right.valueNum - left.valueNum)

      return { coins, totalValue, unallocatedValue }
   }

   #desiredStops(
      portfolio: PortfolioRow, targets: PortfolioTargetRow[], holdings: Map<string, Big>,
      markets: SpotMarket[], prices: Record<string, SpotPrice>
   ) {
      const byBase = planMarkets(markets, prices, portfolio.quoteAsset)
      return planStops(targets
         .filter(({ asset, stopPrice }) => stopPrice !== null && asset !== portfolio.quoteAsset)
         .map(({ asset, stopPrice }) => ({
            asset,
            stopPrice: Big(stopPrice!),
            holding: holdings.get(asset) ?? ZERO,
            market: byBase.get(asset)
         })))
   }

   #stopsDrifted(
      portfolio: PortfolioRow, targets: PortfolioTargetRow[], holdings: Map<string, Big>,
      stops: PortfolioStopRow[], markets: SpotMarket[], prices: Record<string, SpotPrice>,
      now = Date.now()
   ): boolean {

      if (!this.#venue.hardStops) return false

      const cooling = new Set(stops
         .filter(stop => stop.status === 'failed' && now - stop.updatedAt < STOP_RETRY_MS)
         .map(({ asset }) => asset))

      const { desired } = this.#desiredStops(portfolio, targets, holdings, markets, prices)
      const { cancel, place } = stopActions(desired, liveStopsOf(stops.filter(isLiveStop)))

      return cancel.length > 0 || place.some(({ asset }) => !cooling.has(asset))
   }

   async #syncStops(lockKey: string, repository: PortfolioRepository, portfolioId: number): Promise<PortfolioStopSyncResponse> {
      return await serialized(lockKey, () => this.#placeStops(repository, portfolioId))
   }

   async #placeStops(repository: PortfolioRepository, portfolioId: number): Promise<PortfolioStopSyncResponse> {

      const portfolio = repository.portfolio(portfolioId)
      if (!portfolio || !this.#venue.hardStops) return { stops: [], skipped: [] }

      const [markets, prices] = await Promise.all([this.#exchange.markets(), this.#exchange.prices()])
      const targets = repository.targets().filter(row => row.portfolioId === portfolioId)
      const holdings = this.#holdingsOf(repository, portfolioId)

      const { desired, skipped } = this.#desiredStops(portfolio, targets, holdings, markets, prices)
      const live = repository.stopsOf(portfolioId).filter(isLiveStop)
      const { cancel, place } = stopActions(desired, liveStopsOf(live))
      const cancelled = new Set(cancel.map(({ orderLinkId }) => orderLinkId))

      for (const stop of live.filter(({ orderLinkId }) => cancelled.has(orderLinkId))) {
         try {
            await this.#exchange.cancelStopOrder(lookupOf(stop))
            repository.markStop(stop.orderLinkId, { status: 'cancelled', error: null })
         }
         catch (error) {
            repository.markStop(stop.orderLinkId, { status: 'failed', error: this.#describe(error) })
         }
      }

      for (const stop of place) {
         const orderLinkId = `pf${portfolioId}-stp${randomUUID().replace(/-/g, '').slice(0, 8)}`
         const draft = {
            orderLinkId,
            portfolioId,
            asset: stop.asset,
            symbol: stop.symbol,
            quantity: stop.quantity.toFixed(),
            triggerPrice: stop.triggerPrice.toFixed()
         }
         try {
            const orderId = await this.#exchange.placeStopOrder({
               clientOrderId: orderLinkId,
               symbol: draft.symbol,
               quantity: draft.quantity,
               triggerPrice: draft.triggerPrice
            })
            repository.clearStopFailures(portfolioId, stop.asset)
            repository.insertStop({ ...draft, orderId, status: 'placed' })
         }
         catch (error) {
            repository.clearStopFailures(portfolioId, stop.asset)
            repository.insertStop({ ...draft, orderId: null, status: 'failed', error: this.#describe(error) })
         }
      }

      return { stops: repository.stopsOf(portfolioId).filter(isLiveStop).map(stopView), skipped }
   }

   #syncStopsDetached(lockKey: string, repository: PortfolioRepository, portfolioIds: number[]): boolean {

      if (!this.#venue.hardStops || portfolioIds.length === 0) return false
      if (stopSyncs.has(lockKey) || busyAccounts.has(lockKey)) return stopSyncs.has(lockKey)

      stopSyncs.add(lockKey)

      const sync = async () => {
         for (const portfolioId of portfolioIds) await this.#syncStops(lockKey, repository, portfolioId)
      }

      sync()
         .catch(error => console.error('Could not update the stop orders:', error))
         .finally(() => stopSyncs.delete(lockKey))

      return true
   }

   async #cancelStops(lockKey: string, repository: PortfolioRepository, portfolioId: number): Promise<void> {
      if (!this.#venue.hardStops) return
      await serialized(lockKey, async () => {
         for (const stop of repository.stopsOf(portfolioId).filter(isLiveStop)) {
            await this.#exchange.cancelStopOrder(lookupOf(stop))
            repository.markStop(stop.orderLinkId, { status: 'cancelled', error: null })
         }
      })
   }

   #afterStopFill(repository: PortfolioRepository, stop: PortfolioStopRow): void {
      const portfolio = repository.portfolio(stop.portfolioId)
      if (!portfolio) return
      const targets = targetWeights(repository.targets().filter(row => row.portfolioId === stop.portfolioId))
      const next = moveWeightToCash(targets, stop.asset, portfolio.quoteAsset)
      if (next !== targets) repository.replaceTargets(portfolio.id, next)
   }

   async syncStops(body: RequestBody): Promise<PortfolioStopSyncResponse> {
      const { repository, lockKey } = await this.#context()
      if (busyAccounts.has(lockKey)) throw new PortfolioError(409, 'Wait for the running orders to finish first.')
      const portfolio = this.#requirePortfolio(repository, body.portfolioId)
      if (!this.#venue.hardStops) {
         throw new PortfolioError(400, `${this.#venue.label} does not accept stop orders.`)
      }
      return await this.#syncStops(lockKey, repository, portfolio.id)
   }

   async ackStop(body: RequestBody): Promise<PortfolioStopAckResponse> {
      const { repository } = await this.#context()
      return { acknowledged: repository.ackStop(String(body.orderLinkId ?? '')) }
   }

   async markets(): Promise<PortfolioMarketsResponse> {
      const markets = await this.#exchange.markets()
      const { quoteAssets } = this.#venue
      return {
         quoteAssets,
         markets: markets
            .filter(({ quote }) => quoteAssets.includes(quote))
            .map(({ symbol, base, quote, tickStep }) => ({ symbol, base, quote, tickStep }))
            .sort((left, right) => left.base.localeCompare(right.base))
      }
   }

   async supertrend(): Promise<PortfolioSupertrendResponse> {

      const { repository } = await this.#context()
      const listed = new Set((await this.#exchange.markets()).map(({ symbol }) => symbol))
      const holdings = this.#holdings(repository)
      const targets = groupBy(repository.targets(), row => row.portfolioId)

      const symbols = new Set(repository.portfolios().flatMap(({ id, quoteAsset }) =>
         [...(targets.get(id) ?? []).map(({ asset }) => asset), ...(holdings.get(id) ?? new Map()).keys()]
            .filter(asset => asset !== quoteAsset)
            .map(asset => `${asset}${quoteAsset}`)
            .filter(symbol => listed.has(symbol))))

      const levels: Record<string, SupertrendLevels> = {}
      for (const symbol of symbols) levels[symbol] = await this.#supertrendLevels(symbol)

      return { fetchedAt: Date.now(), levels }
   }

   async #supertrendLevels(symbol: string): Promise<SupertrendLevels> {
      const levelFor = async (interval: CandleInterval) =>
         levelOf(supertrend(await this.#exchange.candles(symbol, interval), { interval, now: Date.now() }))
      try {
         const [daily, weekly] = await Promise.all([levelFor('1d'), levelFor('1w')])
         return { daily, weekly }
      }
      catch (error) {
         console.warn(`Could not read the ${symbol} candles:`, this.#describe(error))
         return { daily: null, weekly: null }
      }
   }

   async save(body: RequestBody): Promise<PortfolioSaveResponse> {

      const { repository, lockKey } = await this.#context()
      const id = body.id === undefined || body.id === null ? null : parseId(body.id)

      const name = String(body.name ?? '').trim()
      if (!name || name.length > 60) throw new PortfolioError(400, 'Give the portfolio a name of at most 60 characters.')

      const { quoteAssets } = this.#venue
      const quoteAsset = assetOf(body.quoteAsset || quoteAssets[0])
      if (!quoteAssets.includes(quoteAsset)) throw new PortfolioError(400, `The cash coin must be one of ${quoteAssets.join(', ')}.`)

      const band = parseRange(body.band ?? '1', 'The rebalance band', 0, 50)

      const markets = await this.#exchange.markets()
      const tradable = new Set(markets.filter(({ quote }) => quote === quoteAsset).map(({ base }) => base))
      const targets = validateTargets(body.targets, quoteAsset, tradable)

      if (repository.nameTaken(name, id)) throw new PortfolioError(400, `A portfolio named "${name}" already exists.`)

      const draft = { name, quoteAsset, band: band.toFixed(), targets }

      if (id === null) {
         const created = repository.createPortfolio(draft)
         this.#syncStopsDetached(lockKey, repository, [created])
         return { id: created }
      }

      const existing = this.#requirePortfolio(repository, id)
      if (existing.quoteAsset !== quoteAsset && repository.hasActivity(id)) {
         throw new PortfolioError(400, 'The cash coin cannot change once money has moved through the portfolio.')
      }

      repository.updatePortfolio(id, draft)
      this.#syncStopsDetached(lockKey, repository, [id])
      return { id }
   }

   async archive(body: RequestBody): Promise<PortfolioArchiveResponse> {
      const { repository, lockKey } = await this.#context()
      if (busyAccounts.has(lockKey)) throw new PortfolioError(409, 'Wait for the running orders to finish first.')
      const portfolio = this.#requirePortfolio(repository, body.portfolioId)
      repository.archive(portfolio.id)
      return { archived: portfolio.id }
   }

   async deposit(body: RequestBody): Promise<PortfolioMovementResponse> {

      const { repository, lockKey } = await this.#context()
      if (busyAccounts.has(lockKey)) throw new PortfolioError(409, 'Wait for the running orders to finish first.')

      const portfolio = this.#requirePortfolio(repository, body.portfolioId)
      const quote = portfolio.quoteAsset
      const asset = assetOf(body.asset)
      const amount = parsePositive(body.amount, 'The amount')

      const targeted = repository.targets().some(row => row.portfolioId === portfolio.id && row.asset === asset)
      if (asset !== quote && !targeted) {
         throw new PortfolioError(400, `${asset} is not one of ${portfolio.name}'s targets. Deposit ${quote} or a coin it targets.`)
      }

      const [wallet, markets, prices] = await Promise.all([
         this.#exchange.wallet(), this.#exchange.markets(), this.#exchange.prices()])

      if (asset !== quote && !markets.some(market => market.base === asset && market.quote === quote)) {
         throw new PortfolioError(400, `${asset} has no spot market against ${quote}, so the portfolio could not trade it.`)
      }

      const coin = wallet.find(entry => entry.asset === asset)
      const allocated = [...this.#holdings(repository).values()]
         .reduce((sum, holdings) => sum.plus(holdings.get(asset) ?? ZERO), ZERO)
      const unallocated = Big(coin?.total || 0).minus(coin?.borrowed || 0).minus(allocated)
      const available = minOf(unallocated, Big(coin?.free || 0))

      if (amount.gt(available)) {
         throw new PortfolioError(400, available.gt(0)
            ? `Only ${available.toFixed()} ${asset} is free and not already in a portfolio.`
            : `No ${asset} is free outside your portfolios.`)
      }

      const price = priceIn(prices, asset, quote) ?? ZERO
      const movement = repository.addMovement({
         portfolioId: portfolio.id, kind: 'deposit', asset,
         amount: amount.toFixed(), value: decimal(amount.times(price))
      })

      this.#syncStopsDetached(lockKey, repository, [portfolio.id])
      return { movement: movementView(movement) }
   }

   async adjust(body: RequestBody): Promise<PortfolioMovementResponse> {

      const { repository, lockKey } = await this.#context()
      if (busyAccounts.has(lockKey)) throw new PortfolioError(409, 'Wait for the running orders to finish first.')

      const portfolio = this.#requirePortfolio(repository, body.portfolioId)
      const asset = assetOf(body.asset)
      if (!/^[A-Z0-9]{1,20}$/.test(asset)) throw new PortfolioError(400, 'Name the asset to adjust.')

      const amount = parseDecimal(body.amount, 'The amount')
      if (amount.eq(0)) throw new PortfolioError(400, 'The adjustment cannot be zero.')

      const prices = await this.#exchange.prices()
      const price = priceIn(prices, asset, portfolio.quoteAsset) ?? ZERO
      const movement = repository.addMovement({
         portfolioId: portfolio.id, kind: 'adjust', asset, amount: amount.toFixed(),
         value: decimal(amount.times(price)), note: String(body.note ?? '').trim().slice(0, 200)
      })

      this.#syncStopsDetached(lockKey, repository, [portfolio.id])
      return { movement: movementView(movement) }
   }

   async plan(body: RequestBody): Promise<PortfolioPlanResponse> {

      const { account, repository } = await this.#context()
      const portfolio = this.#requirePortfolio(repository, body.portfolioId)
      const quote = portfolio.quoteAsset

      const kind: RunKind = body.kind === 'withdraw' ? 'withdraw' : 'rebalance'
      const band = body.band === undefined || body.band === '' ? Big(portfolio.band) : parseRange(body.band, 'The band', 0, 50)
      const slippage = parseRange(body.slippage || DEFAULT_SLIPPAGE, 'The slippage tolerance', 0.01, 10).round(2)
      const withdrawAll = kind === 'withdraw' && body.all === true
      const withdraw = kind === 'withdraw' ? (withdrawAll ? 'all' : parsePositive(body.amount, 'The amount to withdraw')) : ZERO
      const mode = kind === 'withdraw' ? 'full' : parseMode(body.mode)
      const exclude = parseExclude(body.exclude)
      const execution = parseExecution(body.execution)
      const wait = parseRange(body.wait || DEFAULT_WAIT_SECONDS, 'The time to wait for an order', 1, 3600).round(0)

      const holdings = this.#holdingsOf(repository, portfolio.id)
      const targets = new Map(repository.targets()
         .filter(({ portfolioId }) => portfolioId === portfolio.id)
         .map(({ asset, weight }) => [asset, Big(weight)]))

      const [wallet, markets, prices] = await Promise.all([
         this.#exchange.wallet(), this.#exchange.markets(), this.#exchange.prices()])

      const byBase = planMarkets(markets, prices, quote)
      const free = new Map(wallet.map(({ asset, free: amount }) => [asset, Big(amount || 0)]))

      if (this.#venue.stopsReserve) {
         for (const stop of repository.stopsOf(portfolio.id).filter(isLiveStop)) {
            free.set(stop.asset, (free.get(stop.asset) ?? ZERO).plus(stop.quantity))
         }
      }

      const symbols = [...new Set([...holdings.keys(), ...targets.keys()])]
         .map(asset => byBase.get(asset)?.symbol)
         .filter(symbol => symbol !== undefined)
      const tradeFees = await this.#tradeFees(symbols)
      const feeRates = new Map([...byBase.values()].flatMap(({ base, symbol }) => {
         const fee = tradeFees[symbol]?.[execution === 'limit' ? 'maker' : 'taker']
         return fee ? [[base, { buy: Big(fee.buy), sell: Big(fee.sell) }] as const] : []
      }))
      const buyFeeInQuote = this.#exchange.buyFeeInQuote

      let plan
      try {
         plan = planPortfolio({
            quote, holdings, targets, markets: byBase, free, band, withdraw, feeRates, buyFeeInQuote, mode, exclude
         })
      }
      catch (error) {
         throw new PortfolioError(400, messageOf(error))
      }

      purgeExpiredPlans()

      const stored: StoredPlan = {
         id: randomUUID(),
         venue: this.#venue.id,
         accountId: account.accountId,
         portfolioId: portfolio.id,
         kind,
         quote,
         withdraw: plan.withdraw,
         withdrawAll,
         reserve: plan.reserve,
         feeRates,
         slippage: slippage.toFixed(),
         execution,
         wait: wait.toFixed(),
         orders: plan.orders,
         markets: byBase,
         holdings,
         expiresAt: Date.now() + PLAN_TTL_MS
      }
      plans.set(stored.id, stored)

      return {
         planId: stored.id,
         portfolioId: portfolio.id,
         venue: this.#venue.id,
         kind,
         mode,
         quoteAsset: quote,
         expiresAt: stored.expiresAt,
         band: band.toFixed(),
         slippage: stored.slippage,
         execution,
         wait: stored.wait,
         total: decimal(plan.total),
         withdraw: decimal(plan.withdraw),
         orders: plan.orders.map(order => {
            const { asset, symbol, side, unit, amount, price, value } = order
            const feeRate = feeRateOf(feeRates, DEFAULT_FEE_RATE, asset, side)
            const fee = orderFee(order, quote, feeRate, buyFeeInQuote)
            return {
               asset, symbol, side, unit, amount: amount.toFixed(), price: price.toFixed(), value: decimal(value),
               fee: { asset: fee.asset, amount: decimal(fee.amount) },
               feeRate: feeRate.toFixed(),
               feeRateAssumed: !feeRates.has(asset)
            }
         }),
         skipped: plan.skipped.map(({ asset, reason, value }) => ({ asset, reason, value: decimal(value) })),
         cashAfter: decimal(plan.cashAfter),
         shortfall: decimal(plan.shortfall),
         canTrade: account.canTrade
      }
   }

   async execute(body: RequestBody): Promise<PortfolioRunResponse> {

      const { account, repository, lockKey } = await this.#context()
      const planId = String(body.planId ?? '')
      const stored = plans.get(planId)

      if (!stored || stored.expiresAt < Date.now()) {
         plans.delete(planId)
         throw new PortfolioError(410, 'This preview has expired. Preview the orders again.')
      }
      if (stored.venue !== this.#venue.id || stored.accountId !== account.accountId) {
         throw new PortfolioError(404, 'This preview belongs to another account.')
      }
      if (busyAccounts.has(lockKey)) throw new PortfolioError(409, 'Another run is still placing orders on this account.')

      busyAccounts.add(lockKey)
      let started = false

      try {
         if (!repository.portfolio(stored.portfolioId)) throw new PortfolioError(404, 'This portfolio does not exist.')

         if (!sameHoldings(this.#holdingsOf(repository, stored.portfolioId), stored.holdings)) {
            throw new PortfolioError(409, 'The portfolio changed since the preview. Preview the orders again.')
         }

         if (stored.orders.length > 0) {
            if (!account.canTrade) {
               throw new PortfolioError(403, `This ${this.#venue.label} API key cannot place spot orders. Give it the Spot trade permission.`)
            }
            await this.#checkPrices(stored)
         }

         plans.delete(planId)

         const runId = randomUUID()
         const tag = runId.replace(/-/g, '').slice(0, 8)
         const orders: OrderDraft[] = stored.orders.map((order, index) => ({
            orderLinkId: `pf${stored.portfolioId}-${tag}-${index + 1}`,
            seq: index + 1,
            symbol: order.symbol,
            side: order.side,
            baseAsset: order.asset,
            quoteAsset: stored.quote,
            unit: order.unit,
            requested: order.amount.toFixed()
         }))

         repository.createRun({
            id: runId,
            portfolioId: stored.portfolioId,
            kind: stored.kind,
            status: 'running',
            withdraw: stored.withdraw.toFixed(),
            reserve: stored.reserve.toFixed(),
            slippage: stored.slippage,
            execution: stored.execution,
            startedAt: Date.now()
         }, orders)

         liveRuns.add(runId)
         started = true

         this.#run(runId, stored, repository, lockKey)
            .catch(error => console.error('Unexpected portfolio run failure:', error))
            .finally(() => {
               liveRuns.delete(runId)
               stoppedRuns.delete(runId)
               busyAccounts.delete(lockKey)
            })

         return { run: this.#runView(repository, runId) }
      }
      finally {
         if (!started) busyAccounts.delete(lockKey)
      }
   }

   async #checkPrices(stored: StoredPlan): Promise<void> {
      const prices = await this.#exchange.prices()
      for (const order of stored.orders) {
         const now = prices[order.symbol]
         const current = Big((order.side === 'sell' ? now?.bid : now?.ask) || 0)
         if (current.lte(0)) throw new PortfolioError(409, `${order.symbol} has no price right now. Preview the orders again.`)

         const moved = current.minus(order.price).abs().div(order.price).times(HUNDRED)
         if (moved.gt(stored.slippage)) {
            throw new PortfolioError(409, `${order.symbol} moved ${moved.toFixed(2)}% since the preview, `
               + `more than the ${stored.slippage}% slippage allowed. Preview the orders again.`)
         }
      }
   }

   async #run(runId: string, stored: StoredPlan, repository: PortfolioRepository, lockKey: string): Promise<void> {

      let status: RunStatus = 'done'
      let withdrawn = ZERO
      let error: string | null = null

      try {
         await this.#cancelStops(lockKey, repository, stored.portfolioId)

         const orders = repository.runOrders(runId)

         for (const order of orders.filter(({ side }) => side === 'sell')) {
            await this.#fill(repository, order, stored)
         }

         await this.#placeBuys(repository, orders.filter(({ side }) => side === 'buy'), stored)

         if (stored.withdraw.gt(0) && !stoppedRuns.has(runId)) {
            const cash = this.#holdingsOf(repository, stored.portfolioId).get(stored.quote) ?? ZERO
            withdrawn = cash.lte(0) ? ZERO : minOf(cash, stored.withdraw)
            if (stored.withdrawAll && cash.gt(0)) withdrawn = cash
            if (withdrawn.gt(0)) {
               repository.addMovement({
                  portfolioId: stored.portfolioId, kind: 'withdraw', asset: stored.quote,
                  amount: withdrawn.times(-1).toFixed(), value: withdrawn.toFixed()
               })
            }
         }

         const settled = attemptsBySeq(repository.runOrders(runId)).map(statusOf)
         const tolerated = stored.withdraw.times(Big(1).minus(Big(stored.slippage).div(HUNDRED)))
         const short = !stored.withdrawAll && withdrawn.lt(tolerated)
         status = settled.some(orderStatus => orderStatus !== 'filled') || short ? 'partial' : 'done'
      }
      catch (caught) {
         console.error('Portfolio run failed:', caught)
         status = 'error'
         error = this.#describe(caught)
      }
      finally {
         repository.finishRun(runId, status, withdrawn.toFixed(), error)
         try {
            await this.#syncStops(lockKey, repository, stored.portfolioId)
         }
         catch (caught) {
            console.error('Could not place the stop orders after the run:', caught)
         }
      }
   }

   async #placeBuys(repository: PortfolioRepository, buys: PortfolioOrderRow[], stored: StoredPlan): Promise<void> {

      if (buys.length === 0) return

      const cash = this.#holdingsOf(repository, stored.portfolioId).get(stored.quote) ?? ZERO
      const wallet = await this.#exchange.wallet()
      const freeCash = Big(wallet.find(({ asset }) => asset === stored.quote)?.free || 0)
      const budget = minOf(cash, freeCash).minus(stored.reserve)
      const cost = buys.reduce((sum, { baseAsset, requested }) => sum.plus(buyCost(
         Big(requested), feeRateOf(stored.feeRates, DEFAULT_FEE_RATE, baseAsset, 'buy'), this.#exchange.buyFeeInQuote)), ZERO)
      const scale = buyScale(budget, cost)

      for (const order of buys) {
         const market = stored.markets.get(order.baseAsset)!
         const amount = floorTo(Big(order.requested).times(scale), market.quoteStep)

         if (!buyFits(market, amount)) {
            repository.markOrder(order.orderLinkId, {
               status: 'skipped',
               requested: amount.toFixed(),
               error: scale.lt(1) ? 'Not enough cash was left after the sells.' : 'Below the minimum order size.'
            })
            continue
         }

         const resized = { ...order, requested: amount.toFixed() }
         if (resized.requested !== order.requested) {
            repository.markOrder(order.orderLinkId, { status: 'pending', requested: resized.requested })
         }
         await this.#fill(repository, resized, stored)
      }
   }

   async #fill(repository: PortfolioRepository, order: PortfolioOrderRow, stored: StoredPlan): Promise<void> {
      if (stoppedRuns.has(order.runId)) {
         repository.markOrder(order.orderLinkId, { status: 'skipped', error: STOPPED })
         return
      }
      if (stored.execution === 'limit') await this.#chase(repository, order, stored)
      else await this.#placeAndSettle(repository, order, stored.slippage)
   }

   async #chase(repository: PortfolioRepository, planned: PortfolioOrderRow, stored: StoredPlan): Promise<void> {

      const market = stored.markets.get(planned.baseAsset)!
      const preview = stored.orders[planned.seq - 1]!.price
      const chase: Chase = {
         runId: planned.runId,
         market,
         bound: priceBound(planned.side, preview, Big(stored.slippage), market.tickStep),
         deadline: Date.now() + Number(stored.wait) * 1000,
         wait: stored.wait
      }

      let order = planned
      let status: RunOrderStatus = 'cancelled'
      let closed = false
      let remaining = Big(planned.requested)
      let refusals = 0

      const end = (error: string) => repository.markOrder(order.orderLinkId, { status, error })

      for (;;) {
         const halted = this.#halted(chase)
         if (halted) return end(halted)

         const price = await this.#desiredPrice(order, chase)
         if (!price) {
            await delay(this.#exchange.chasePacing.pollMs)
            continue
         }

         const quantity = limitQuantity(order.unit, remaining, price, market)
         if (!limitFits(market, quantity, price)) return end(TOO_SMALL)

         if (closed) {
            order = repository.addAttempt({
               ...order,
               orderLinkId: `${planned.orderLinkId.replace(/-\d+$/, '')}-${repository.orderCount(planned.runId) + 1}`,
               requested: remaining.toFixed()
            })
            status = 'cancelled'
            closed = false
         }

         const placed = await this.#placeLimit(repository, order, quantity, price)
         if (placed === 'ended') return
         if (placed === 'refused') {
            if (++refusals > MAX_REFUSALS) return end(WOULD_TAKE)
            await delay(this.#exchange.chasePacing.pollMs)
            continue
         }

         order = placed
         const { settlement, note, again } = await this.#rest(order, price, remaining, chase)

         if (!settlement) {
            repository.markOrder(order.orderLinkId, { status: 'unknown', error: note })
            return
         }

         status = attemptStatus(settlement)
         closed = true
         remaining = remaining.minus(filledIn(order, settlement))
         refusals = settlement.postOnlyRefused ? refusals + 1 : 0

         repository.settleOrder(order, {
            orderId: settlement.orderId,
            status,
            base: settlement.base,
            quote: settlement.quote,
            averagePrice: settlement.averagePrice,
            error: status === 'filled' ? null : note
         }, await this.#feesAtFill(order, settlement))

         if (status === 'filled' || !again) return
         if (refusals > MAX_REFUSALS) return end(WOULD_TAKE)
      }
   }

   #halted({ runId, deadline, wait }: Chase): string | null {
      if (stoppedRuns.has(runId)) return STOPPED
      return Date.now() >= deadline ? `Not filled within ${wait} s.` : null
   }

   async #desiredPrice(order: PortfolioOrderRow, { market, bound }: Chase): Promise<Big | null> {
      try {
         const price = (await this.#exchange.prices())[order.symbol]
         const book = { bid: Big(price?.bid || 0), ask: Big(price?.ask || 0) }
         return restingPrice(order.side, book, market.tickStep, bound)
      }
      catch (error) {
         console.warn('Could not read the price of', order.symbol, this.#describe(error))
         return null
      }
   }

   async #placeLimit(
      repository: PortfolioRepository, order: PortfolioOrderRow, quantity: Big, price: Big
   ): Promise<PortfolioOrderRow | 'refused' | 'ended'> {

      const limitPrice = price.toFixed()

      try {
         const orderId = await this.#exchange.placeLimitOrder({
            clientOrderId: order.orderLinkId,
            symbol: order.symbol,
            side: order.side,
            quantity: quantity.toFixed(),
            price: limitPrice
         })
         repository.markOrder(order.orderLinkId, { status: 'placed', orderId, limitPrice })
         return { ...order, orderId, limitPrice }
      }
      catch (error) {
         if (error instanceof HttpRequesterError && this.#exchange.isPostOnlyRefusal(error)) return 'refused'

         if (this.#isRejection(error)) {
            repository.markOrder(order.orderLinkId, { status: 'rejected', error: this.#describe(error) })
            return 'ended'
         }

         repository.markOrder(order.orderLinkId, { status: 'unknown', limitPrice, error: this.#describe(error) })
         return await this.#reached(repository, { ...order, limitPrice })
      }
   }

   async #reached(repository: PortfolioRepository, order: PortfolioOrderRow): Promise<PortfolioOrderRow | 'ended'> {

      for (let attempt = 1; attempt <= REACHED_ATTEMPTS; attempt++) {
         await delay(SETTLE_DELAY_MS)
         const settlement = await this.#peek(order)
         if (!settlement) continue
         repository.markOrder(order.orderLinkId, { status: 'placed', orderId: settlement.orderId })
         return { ...order, orderId: settlement.orderId }
      }

      repository.markOrder(order.orderLinkId, { status: 'failed', error: `The order never reached ${this.#venue.label}.` })
      return 'ended'
   }

   async #rest(order: PortfolioOrderRow, price: Big, remaining: Big, chase: Chase): Promise<Rested> {

      const { pollMs, moveAfterMs } = this.#exchange.chasePacing
      const movableAt = Date.now() + moveAfterMs
      let failures = 0

      for (;;) {
         await delay(pollMs)

         const settlement = await this.#peek(order)

         if (settlement && settlement.status !== 'open') {
            const final = await this.#closed(order, settlement) ?? settlement
            if (final.postOnlyRefused) return { settlement: final, note: WOULD_TAKE, again: true }
            return { settlement: final, note: final.reason || `Cancelled on ${this.#venue.label}.`, again: false }
         }

         const halted = this.#halted(chase)
         const left = remaining.minus(filledIn(order, settlement))
         const moved = !halted && Date.now() >= movableAt && await this.#leftBehind(order, price, left, chase)
         const note = halted ?? (moved ? MOVED : null)
         if (!note) continue

         try {
            await this.#exchange.cancelOrder(lookupOf(order))
         }
         catch (error) {
            console.warn('Could not cancel order', order.orderLinkId, this.#describe(error))
            if (++failures >= MAX_CANCEL_FAILURES) return { settlement: null, note: this.#describe(error), again: false }
            continue
         }

         const final = await this.#closed(order)
         return final
            ? { settlement: final, note, again: !halted }
            : { settlement: null, note: `${this.#venue.label} had not closed the order yet. It is checked again on the next refresh.`, again: false }
      }
   }

   async #leftBehind(order: PortfolioOrderRow, price: Big, remaining: Big, chase: Chase): Promise<boolean> {
      const desired = await this.#desiredPrice(order, chase)
      if (!desired || !leftBehind(order.side, price, desired)) return false
      return limitFits(chase.market, limitQuantity(order.unit, remaining, desired, chase.market), desired)
   }

   async #peek(order: PortfolioOrderRow): Promise<OrderSettlement | null> {
      try {
         return await this.#exchange.settleOrder(lookupOf(order))
      }
      catch (error) {
         console.warn('Could not check order', order.orderLinkId, this.#describe(error))
         return null
      }
   }

   async #closed(order: PortfolioOrderRow, known: OrderSettlement | null = null): Promise<OrderSettlement | null> {

      for (let attempt = 1; attempt <= SETTLE_ATTEMPTS; attempt++) {
         const settlement = attempt === 1 && known ? known : await this.#peek(order)
         const feesPending = settlement !== null && executed(settlement)
            && Object.keys(settlement.fees).length === 0 && attempt < FEE_GRACE_ATTEMPTS

         if (settlement && settlement.status !== 'open' && !feesPending) return settlement
         await delay(SETTLE_DELAY_MS)
      }

      return null
   }

   async #placeAndSettle(repository: PortfolioRepository, order: PortfolioOrderRow, slippage: string): Promise<void> {

      let placed = true
      let orderId: string | null = null

      try {
         orderId = await this.#exchange.placeOrder({
            clientOrderId: order.orderLinkId,
            symbol: order.symbol,
            side: order.side,
            unit: order.unit,
            amount: order.requested,
            maxSlippagePercent: slippage
         })
         repository.markOrder(order.orderLinkId, { status: 'placed', orderId })
      }
      catch (error) {
         if (this.#isRejection(error)) {
            repository.markOrder(order.orderLinkId, { status: 'rejected', error: this.#describe(error) })
            return
         }
         placed = false
         repository.markOrder(order.orderLinkId, { status: 'unknown', error: this.#describe(error) })
      }

      await this.#settle(repository, { ...order, orderId }, placed)
   }

   async #settle(repository: PortfolioRepository, order: PortfolioOrderRow, placed: boolean): Promise<void> {

      for (let attempt = 1; attempt <= SETTLE_ATTEMPTS; attempt++) {
         await delay(SETTLE_DELAY_MS)

         let settlement: OrderSettlement | null
         try {
            settlement = await this.#exchange.settleOrder(lookupOf(order))
         }
         catch (error) {
            console.warn('Could not check order', order.orderLinkId, this.#describe(error))
            continue
         }

         if (!settlement) {
            if (!placed && attempt >= 4) {
               repository.markOrder(order.orderLinkId, {
                  status: 'failed', error: `The order never reached ${this.#venue.label}.`
               })
               return
            }
            continue
         }

         if (settlement.status === 'open') continue

         const executed = Big(settlement.base || 0).gt(0)
         if (executed && Object.keys(settlement.fees).length === 0 && attempt < FEE_GRACE_ATTEMPTS) continue

         this.#record(repository, order, settlement, await this.#feesAtFill(order, settlement))
         return
      }

      repository.markOrder(order.orderLinkId, {
         status: 'unknown',
         error: `${this.#venue.label} had not settled the order yet. It is checked again on the next refresh.`
      })
   }

   async #feesAtFill(order: PortfolioOrderRow, settlement: OrderSettlement): Promise<FeeDraft[]> {
      const fees = feesOf(settlement)
      if (fees.every(({ asset }) => asset === order.baseAsset || asset === order.quoteAsset)) return fees

      try {
         const prices = await this.#exchange.prices()
         return fees.map(({ asset, amount }) =>
            ({ asset, amount, value: decimal(Big(amount).times(priceIn(prices, asset, order.quoteAsset) ?? ZERO)) }))
      }
      catch (error) {
         console.warn('Could not price the fees of order', order.orderLinkId, this.#describe(error))
         return fees
      }
   }

   #record(repository: PortfolioRepository, order: PortfolioOrderRow, settlement: OrderSettlement, fees = feesOf(settlement)): void {
      repository.settleOrder(order, {
         orderId: settlement.orderId,
         status: settlement.status === 'filled' ? 'filled' : settlement.status === 'partial' ? 'partial' : 'rejected',
         base: settlement.base,
         quote: settlement.quote,
         averagePrice: settlement.averagePrice,
         error: settlement.reason || null
      }, fees)
   }

   async #reconcile(repository: PortfolioRepository): Promise<number> {

      let count = 0

      for (const order of repository.unsettledOrders()) {
         if (liveRuns.has(order.runId)) continue
         try {
            const settlement = await this.#exchange.settleOrder(lookupOf(order))

            if (settlement?.status === 'open') {
               const closed = await this.#abandoned(order)
               if (!closed || closed.status === 'open') continue

               const status = attemptStatus(closed)
               repository.settleOrder(order, {
                  orderId: closed.orderId,
                  status,
                  base: closed.base,
                  quote: closed.quote,
                  averagePrice: closed.averagePrice,
                  error: status === 'filled' ? null : 'Cancelled: the run stopped first.'
               }, feesOf(closed))
            }
            else if (settlement) this.#record(repository, order, settlement)
            else {
               repository.markOrder(order.orderLinkId, order.status === 'pending'
                  ? { status: 'skipped', error: 'Never placed: the run stopped first.' }
                  : { status: 'failed', error: `${this.#venue.label} has no record of this order.` })
            }
            count++
         }
         catch (error) {
            console.warn('Could not reconcile order', order.orderLinkId, this.#describe(error))
         }
      }

      for (const run of repository.runningRuns()) {
         if (liveRuns.has(run.id)) continue
         repository.finishRun(run.id, 'interrupted', run.withdrawn,
            'The app stopped before the run finished. Filled orders were recorded; preview again to finish.')
         count++
      }

      return count + await this.#reconcileStops(repository)
   }

   async #abandoned(order: PortfolioOrderRow): Promise<OrderSettlement | null> {
      await this.#exchange.cancelOrder(lookupOf(order))
      return await this.#exchange.settleOrder(lookupOf(order))
   }

   async #reconcileStops(repository: PortfolioRepository): Promise<number> {

      const live = repository.liveStops()
      if (!this.#venue.hardStops || live.length === 0) return 0

      let resting: Set<string>
      try {
         resting = new Set((await this.#exchange.openStopOrders()).map(({ clientOrderId }) => clientOrderId))
      }
      catch (error) {
         console.warn('Could not read the resting stop orders', this.#describe(error))
         return 0
      }

      let count = 0

      for (const stop of live) {
         if (resting.has(stop.orderLinkId)) continue

         try {
            const settlement = await this.#exchange.settleOrder(lookupOf(stop))
            if (settlement?.status === 'open') continue

            if (!settlement) {
               repository.markStop(stop.orderLinkId, {
                  status: 'missing', error: `${this.#venue.label} has no record of this stop order.`
               })
            }
            else if (settlement.status === 'rejected') {
               repository.markStop(stop.orderLinkId, {
                  status: 'failed',
                  error: settlement.reason || `${this.#venue.label} could not fill the stop order.`
               })
            }
            else {
               repository.recordStopFill(stop, {
                  runId: randomUUID(),
                  quoteAsset: repository.portfolio(stop.portfolioId)?.quoteAsset ?? this.#venue.valuationAsset,
                  outcome: {
                     orderId: settlement.orderId,
                     status: settlement.status === 'filled' ? 'filled' : 'partial',
                     base: settlement.base,
                     quote: settlement.quote,
                     averagePrice: settlement.averagePrice,
                     error: settlement.reason || null
                  }
               }, feesOf(settlement))
               this.#afterStopFill(repository, stop)
            }

            count++
         }
         catch (error) {
            console.warn('Could not reconcile stop order', stop.orderLinkId, this.#describe(error))
         }
      }

      return count
   }

   #runView(repository: PortfolioRepository, runId: string): PortfolioRun {
      const run = repository.run(runId)
      if (!run) throw new PortfolioError(404, 'This run does not exist.')

      const orders = repository.runOrders(runId)
      const fees = repository.feesByOrder(orders.map(({ orderLinkId }) => orderLinkId))

      return {
         id: run.id,
         portfolioId: run.portfolioId,
         kind: run.kind,
         execution: run.execution,
         status: run.status,
         running: liveRuns.has(run.id),
         stopping: liveRuns.has(run.id) && stoppedRuns.has(run.id),
         withdraw: run.withdraw,
         withdrawn: run.withdrawn,
         startedAt: run.startedAt,
         finishedAt: run.finishedAt,
         error: run.error,
         orders: attemptsBySeq(orders).map(attempts => orderView(attempts, fees))
      }
   }

   async stop(body: RequestBody): Promise<PortfolioRunResponse> {
      const { repository } = await this.#context()
      const runId = String(body.runId ?? '')
      if (repository.run(runId) && liveRuns.has(runId)) stoppedRuns.add(runId)
      return { run: this.#runView(repository, runId) }
   }

   async run(body: RequestBody): Promise<PortfolioRunResponse> {
      const { repository } = await this.#context()
      return { run: this.#runView(repository, String(body.runId ?? '')) }
   }

   async history(body: RequestBody): Promise<PortfolioHistoryResponse> {
      const { repository } = await this.#context()
      const portfolio = this.#requirePortfolio(repository, body.portfolioId)
      return {
         movements: repository.portfolioMovements(portfolio.id).map(movementView),
         runs: repository.runs(portfolio.id).map(run => this.#runView(repository, run.id))
      }
   }
}
