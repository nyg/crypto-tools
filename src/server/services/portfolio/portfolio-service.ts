import Big from 'big.js'
import { randomUUID } from 'crypto'
import PortfolioRepository from '../../db/portfolio-repository'
import { HttpRequesterError, messageOf } from '../../errors'
import { foldHoldings, sameHoldings } from './holdings'
import { buyFits, buyScale, floorTo, planPortfolio } from './planner'
import { foldPositions } from './positions'
import { validateTargets } from './targets'
import type { PortfolioExchange } from './exchange'
import type { PlanMarket, PlannedOrder } from './planner'
import type { Venue } from './venues'
import type { RequestBody } from '../../routes/with-account'
import type { OrderDraft } from '../../db/portfolio-repository'
import type {
   PortfolioMovementRow, PortfolioOrderRow, PortfolioRow, PortfolioTargetRow
} from '../../../types/db'
import type {
   AccountCoin, PortfolioArchiveResponse, PortfolioHistoryResponse, PortfolioHolding,
   PortfolioMarketsResponse, PortfolioMovement, PortfolioMovementResponse,
   PortfolioOverviewResponse, PortfolioPlanResponse, PortfolioRun, PortfolioRunResponse,
   PortfolioSaveResponse, PortfolioSummary
} from '../../../types/api'
import type {
   ExchangeAccount, OrderSettlement, RunKind, RunStatus, SpotMarket, SpotPrice, VenueId, WalletCoin
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
   slippage: string
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

export const QUOTE_ASSETS = ['USDT', 'USDC']

const VALUATION_ASSET = 'USDT'
const PLAN_TTL_MS = 2 * 60 * 1000
const DEFAULT_SLIPPAGE = '1'
const SETTLE_ATTEMPTS = 20
const SETTLE_DELAY_MS = 500
const FEE_GRACE_ATTEMPTS = 6
const AMBIGUOUS_CODES = [10000, 10016]

const plans = new Map<string, StoredPlan>()
const busyAccounts = new Set<string>()
const liveRuns = new Set<string>()

const ZERO = Big(0)
const HUNDRED = Big(100)

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const decimal = (value: Big, places = 8) => value.round(places).toFixed()

const minOf = (left: Big, right: Big) => left.lt(right) ? left : right

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

function describeError(error: unknown): string {
   if (error instanceof HttpRequesterError) {
      const body = error.body as { retCode?: number, retMsg?: string } | string
      if (typeof body === 'object' && body?.retMsg) return `${body.retMsg} (${body.retCode})`
      return String(error.cause)
   }
   return messageOf(error)
}

function isRejection(error: unknown): boolean {
   if (!(error instanceof HttpRequesterError) || error.statusCode >= 500) return false
   const retCode = (error.body as { retCode?: number } | undefined)?.retCode
   return !AMBIGUOUS_CODES.includes(retCode ?? -1)
}

const movementView = ({ id, kind, asset, amount, value, orderLinkId, note, createdAt }: PortfolioMovementRow): PortfolioMovement =>
   ({ id, kind, asset, amount, value, orderLinkId, note, createdAt })

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

      const { account, repository } = await this.#context()
      const reconciled = await this.#reconcile(repository)
      const [wallet, prices] = await Promise.all([this.#exchange.wallet(), this.#exchange.prices()])

      const holdings = this.#holdings(repository)
      const targets = groupBy(repository.targets(), row => row.portfolioId)
      const movements = groupBy(repository.movements(), row => row.portfolioId)
      const orders = groupBy(repository.orders(), row => row.portfolioId)

      const portfolios = repository.portfolios().map(portfolio => this.#summarize(
         repository, portfolio, targets.get(portfolio.id) ?? [], holdings.get(portfolio.id) ?? new Map(),
         movements.get(portfolio.id) ?? [], orders.get(portfolio.id) ?? [], prices))

      const { coins, totalValue, unallocatedValue } = this.#coins(wallet, [...holdings.values()], prices)
      const activeRun = repository.runningRuns().find(run => liveRuns.has(run.id))

      return {
         fetchedAt: Date.now(),
         venue: this.#venue.id,
         accountId: account.accountId,
         key: { canTrade: account.canTrade, expiresAt: account.expiresAt },
         valuationAsset: VALUATION_ASSET,
         coins,
         totalValue: decimal(totalValue, 2),
         unallocatedValue: decimal(unallocatedValue, 2),
         portfolios,
         activeRun: activeRun ? { id: activeRun.id, portfolioId: activeRun.portfolioId } : null,
         reconciled
      }
   }

   #summarize(
      repository: PortfolioRepository, portfolio: PortfolioRow, targets: PortfolioTargetRow[],
      holdings: Map<string, Big>, movements: PortfolioMovementRow[], orders: PortfolioOrderRow[],
      prices: Record<string, SpotPrice>
   ): PortfolioSummary {

      const quote = portfolio.quoteAsset
      const positions = foldPositions(quote, movements, orders)
      const weights = new Map(targets.map(({ asset, weight }) => [asset, Big(weight)]))
      const others = [...holdings.keys()].filter(asset => !weights.has(asset))
      const assets = [...weights.keys(), ...others]

      const valued = assets.map(asset => {
         const quantity = holdings.get(asset) ?? ZERO
         const price = priceIn(prices, asset, quote)
         return { asset, quantity, price, value: price ? quantity.times(price) : null }
      })

      const total = valued.reduce((sum, { value }) => sum.plus(value ?? ZERO), ZERO)

      const rows: PortfolioHolding[] = valued.map(({ asset, quantity, price, value }) => {
         const target = weights.get(asset) ?? ZERO
         const weight = value && total.gt(0) ? value.div(total).times(HUNDRED) : null
         const position = asset === quote ? null : positions.coins.get(asset) ?? null
         const realized = asset === quote ? positions.cashRealized : position?.realized ?? ZERO
         return {
            asset,
            quantity: quantity.toFixed(),
            price: price ? price.toFixed() : null,
            value: value ? decimal(value) : null,
            valueNum: value ? value.toNumber() : 0,
            weight: weight ? decimal(weight, 4) : null,
            target: target.toFixed(),
            drift: weight ? decimal(weight.minus(target), 4) : null,
            averageCost: position?.quantity.gt(0) ? decimal(position.cost.div(position.quantity)) : null,
            unrealized: position && value ? decimal(value.minus(position.cost)) : null,
            realized: decimal(realized)
         }
      })

      const listed = new Set(assets)
      const realizedTotal = [...positions.coins].reduce((sum, [asset, position]) =>
         sum.plus(position.realized).minus(listed.has(asset) ? ZERO : position.cost), positions.cashRealized)
      const unrealizedTotal = rows.reduce((sum, row) => sum.plus(row.unrealized ?? ZERO), ZERO)
      const realizedInRows = rows.reduce((sum, row) => sum.plus(row.realized), ZERO)

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
         targets: targets.map(({ asset, weight }) => ({ asset, weight })),
         holdings: rows,
         value: decimal(total),
         valueNum: total.toNumber(),
         netInvested: decimal(netInvested),
         profit: decimal(total.minus(netInvested)),
         realized: decimal(realizedTotal),
         unrealized: decimal(unrealizedTotal),
         closedRealized: decimal(realizedTotal.minus(realizedInRows)),
         maxDrift: decimal(maxDrift, 4),
         needsRebalance: total.gt(0) && maxDrift.gt(portfolio.band),
         quoteLocked: repository.hasActivity(portfolio.id)
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
         const price = priceIn(prices, asset, VALUATION_ASSET)
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

   async markets(): Promise<PortfolioMarketsResponse> {
      const markets = await this.#exchange.markets()
      return {
         quoteAssets: QUOTE_ASSETS,
         markets: markets
            .filter(({ quote }) => QUOTE_ASSETS.includes(quote))
            .map(({ symbol, base, quote }) => ({ symbol, base, quote }))
            .sort((left, right) => left.base.localeCompare(right.base))
      }
   }

   async save(body: RequestBody): Promise<PortfolioSaveResponse> {

      const { repository } = await this.#context()
      const id = body.id === undefined || body.id === null ? null : parseId(body.id)

      const name = String(body.name ?? '').trim()
      if (!name || name.length > 60) throw new PortfolioError(400, 'Give the portfolio a name of at most 60 characters.')

      const quoteAsset = assetOf(body.quoteAsset || 'USDT')
      if (!QUOTE_ASSETS.includes(quoteAsset)) throw new PortfolioError(400, `The cash coin must be one of ${QUOTE_ASSETS.join(', ')}.`)

      const band = parseRange(body.band ?? '1', 'The rebalance band', 0, 50)

      const markets = await this.#exchange.markets()
      const tradable = new Set(markets.filter(({ quote }) => quote === quoteAsset).map(({ base }) => base))
      const targets = validateTargets(body.targets, quoteAsset, tradable)

      if (repository.nameTaken(name, id)) throw new PortfolioError(400, `A portfolio named "${name}" already exists.`)

      const draft = { name, quoteAsset, band: band.toFixed(), targets }

      if (id === null) return { id: repository.createPortfolio(draft) }

      const existing = this.#requirePortfolio(repository, id)
      if (existing.quoteAsset !== quoteAsset && repository.hasActivity(id)) {
         throw new PortfolioError(400, 'The cash coin cannot change once money has moved through the portfolio.')
      }

      repository.updatePortfolio(id, draft)
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

      const holdings = this.#holdingsOf(repository, portfolio.id)
      const targets = new Map(repository.targets()
         .filter(({ portfolioId }) => portfolioId === portfolio.id)
         .map(({ asset, weight }) => [asset, Big(weight)]))

      const [wallet, markets, prices] = await Promise.all([
         this.#exchange.wallet(), this.#exchange.markets(), this.#exchange.prices()])

      const byBase = planMarkets(markets, prices, quote)
      const free = new Map(wallet.map(({ asset, free: amount }) => [asset, Big(amount || 0)]))

      let plan
      try {
         plan = planPortfolio({ quote, holdings, targets, markets: byBase, free, band, withdraw })
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
         slippage: slippage.toFixed(),
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
         quoteAsset: quote,
         expiresAt: stored.expiresAt,
         band: band.toFixed(),
         slippage: stored.slippage,
         total: decimal(plan.total),
         withdraw: decimal(plan.withdraw),
         orders: plan.orders.map(({ asset, symbol, side, unit, amount, price, value }) => ({
            asset, symbol, side, unit, amount: amount.toFixed(), price: price.toFixed(), value: decimal(value)
         })),
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
            startedAt: Date.now()
         }, orders)

         liveRuns.add(runId)
         started = true

         this.#run(runId, stored, repository)
            .catch(error => console.error('Unexpected portfolio run failure:', error))
            .finally(() => {
               liveRuns.delete(runId)
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

   async #run(runId: string, stored: StoredPlan, repository: PortfolioRepository): Promise<void> {

      let status: RunStatus = 'done'
      let withdrawn = ZERO
      let error: string | null = null

      try {
         const orders = repository.runOrders(runId)

         for (const order of orders.filter(({ side }) => side === 'sell')) {
            await this.#placeAndSettle(repository, order, stored.slippage)
         }

         await this.#placeBuys(repository, orders.filter(({ side }) => side === 'buy'), stored)

         if (stored.withdraw.gt(0)) {
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

         const settled = repository.runOrders(runId)
         const tolerated = stored.withdraw.times(Big(1).minus(Big(stored.slippage).div(HUNDRED)))
         const short = !stored.withdrawAll && withdrawn.lt(tolerated)
         status = settled.some(order => order.status !== 'filled') || short ? 'partial' : 'done'
      }
      catch (caught) {
         console.error('Portfolio run failed:', caught)
         status = 'error'
         error = describeError(caught)
      }
      finally {
         repository.finishRun(runId, status, withdrawn.toFixed(), error)
      }
   }

   async #placeBuys(repository: PortfolioRepository, buys: PortfolioOrderRow[], stored: StoredPlan): Promise<void> {

      if (buys.length === 0) return

      const cash = this.#holdingsOf(repository, stored.portfolioId).get(stored.quote) ?? ZERO
      const wallet = await this.#exchange.wallet()
      const freeCash = Big(wallet.find(({ asset }) => asset === stored.quote)?.free || 0)
      const budget = minOf(cash, freeCash).minus(stored.reserve)
      const planned = buys.reduce((sum, { requested }) => sum.plus(requested), ZERO)
      const scale = buyScale(budget, planned)

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
         await this.#placeAndSettle(repository, resized, stored.slippage)
      }
   }

   async #placeAndSettle(repository: PortfolioRepository, order: PortfolioOrderRow, slippage: string): Promise<void> {

      let placed = true

      try {
         const orderId = await this.#exchange.placeOrder({
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
         if (isRejection(error)) {
            repository.markOrder(order.orderLinkId, { status: 'rejected', error: describeError(error) })
            return
         }
         placed = false
         repository.markOrder(order.orderLinkId, { status: 'unknown', error: describeError(error) })
      }

      await this.#settle(repository, order, placed)
   }

   async #settle(repository: PortfolioRepository, order: PortfolioOrderRow, placed: boolean): Promise<void> {

      for (let attempt = 1; attempt <= SETTLE_ATTEMPTS; attempt++) {
         await delay(SETTLE_DELAY_MS)

         let settlement: OrderSettlement | null
         try {
            settlement = await this.#exchange.settleOrder(order.orderLinkId)
         }
         catch (error) {
            console.warn('Could not check order', order.orderLinkId, describeError(error))
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

         this.#record(repository, order, settlement)
         return
      }

      repository.markOrder(order.orderLinkId, {
         status: 'unknown',
         error: `${this.#venue.label} had not settled the order yet. It is checked again on the next refresh.`
      })
   }

   #record(repository: PortfolioRepository, order: PortfolioOrderRow, settlement: OrderSettlement): void {
      repository.settleOrder(order, {
         orderId: settlement.orderId,
         status: settlement.status === 'filled' ? 'filled' : settlement.status === 'partial' ? 'partial' : 'rejected',
         base: settlement.base,
         quote: settlement.quote,
         averagePrice: settlement.averagePrice,
         error: settlement.reason || null
      }, Object.entries(settlement.fees).map(([asset, amount]) => ({ asset, amount })))
   }

   async #reconcile(repository: PortfolioRepository): Promise<number> {

      let count = 0

      for (const order of repository.unsettledOrders()) {
         if (liveRuns.has(order.runId)) continue
         try {
            const settlement = await this.#exchange.settleOrder(order.orderLinkId)
            if (settlement?.status === 'open') continue

            if (settlement) this.#record(repository, order, settlement)
            else {
               repository.markOrder(order.orderLinkId, order.status === 'pending'
                  ? { status: 'skipped', error: 'Never placed: the run stopped first.' }
                  : { status: 'failed', error: `${this.#venue.label} has no record of this order.` })
            }
            count++
         }
         catch (error) {
            console.warn('Could not reconcile order', order.orderLinkId, describeError(error))
         }
      }

      for (const run of repository.runningRuns()) {
         if (liveRuns.has(run.id)) continue
         repository.finishRun(run.id, 'interrupted', run.withdrawn,
            'The app stopped before the run finished. Filled orders were recorded; preview again to finish.')
         count++
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
         status: run.status,
         running: liveRuns.has(run.id),
         withdraw: run.withdraw,
         withdrawn: run.withdrawn,
         startedAt: run.startedAt,
         finishedAt: run.finishedAt,
         error: run.error,
         orders: orders.map(order => ({
            orderLinkId: order.orderLinkId,
            seq: order.seq,
            symbol: order.symbol,
            side: order.side,
            unit: order.unit,
            requested: order.requested,
            status: order.status,
            base: order.base,
            quote: order.quote,
            averagePrice: order.averagePrice,
            fees: fees.get(order.orderLinkId) ?? [],
            error: order.error
         }))
      }
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
