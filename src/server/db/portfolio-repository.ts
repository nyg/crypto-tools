import Big from 'big.js'
import type { Database, SQLQueryBindings } from 'bun:sqlite'
import { getDatabase } from './database'
import type {
   PortfolioMovementRow, PortfolioOrderRow, PortfolioRow, PortfolioRunRow, PortfolioTargetRow
} from '../../types/db'
import type {
   FeeAmount, MovementKind, RunOrderStatus, RunStatus, VenueId
} from '../../types/portfolio'
import type { PortfolioTarget } from '../../types/api'

type Params = SQLQueryBindings[]

export interface PortfolioDraft {
   name: string
   quoteAsset: string
   band: string
   targets: PortfolioTarget[]
}

export interface MovementDraft {
   portfolioId: number
   kind: MovementKind
   asset: string
   amount: string
   value: string
   orderLinkId?: string | null
   note?: string
}

export type RunDraft = Omit<PortfolioRunRow, 'withdrawn' | 'error' | 'finishedAt'>

export type OrderDraft = Pick<PortfolioOrderRow,
   'orderLinkId' | 'seq' | 'symbol' | 'side' | 'baseAsset' | 'quoteAsset' | 'unit' | 'requested'>

export interface OrderOutcome {
   orderId: string | null
   status: RunOrderStatus
   base: string
   quote: string
   averagePrice: string
   error: string | null
}

const ownedPortfolio = 'portfolio_id IN (SELECT id FROM portfolio WHERE venue = ? AND account_id = ?)'
const activePortfolio = `portfolio_id IN (
   SELECT id FROM portfolio WHERE venue = ? AND account_id = ? AND archived_at IS NULL)`

const portfolioColumns = 'id, name, quote_asset AS quoteAsset, band, created_at AS createdAt'

const movementColumns = `id, portfolio_id AS portfolioId, kind, asset, amount, value,
   order_link_id AS orderLinkId, note, created_at AS createdAt`

const runColumns = `id, portfolio_id AS portfolioId, kind, status, withdraw, withdrawn, reserve,
   slippage, error, started_at AS startedAt, finished_at AS finishedAt`

const orderColumns = `order_link_id AS orderLinkId, run_id AS runId, portfolio_id AS portfolioId,
   seq, symbol, side, base_asset AS baseAsset, quote_asset AS quoteAsset, unit, requested,
   order_id AS orderId, status, cum_base AS base, cum_quote AS quote, avg_price AS averagePrice,
   error, created_at AS createdAt, updated_at AS updatedAt`

const unsettledStatuses = '(\'pending\', \'placed\', \'unknown\')'

export default class PortfolioRepository {

   readonly #db: Database
   readonly #venue: VenueId
   readonly #accountId: string

   constructor(venue: VenueId, accountId: string) {
      this.#db = getDatabase()
      this.#venue = venue
      this.#accountId = accountId
   }

   get #scope(): Params {
      return [this.#venue, this.#accountId]
   }

   portfolios(): PortfolioRow[] {
      return this.#db.query<PortfolioRow, Params>(`
         SELECT ${portfolioColumns} FROM portfolio
         WHERE venue = ? AND account_id = ? AND archived_at IS NULL
         ORDER BY created_at, id`).all(...this.#scope)
   }

   portfolio(id: number): PortfolioRow | null {
      return this.#db.query<PortfolioRow, Params>(`
         SELECT ${portfolioColumns} FROM portfolio
         WHERE id = ? AND venue = ? AND account_id = ? AND archived_at IS NULL`).get(id, ...this.#scope)
   }

   nameTaken(name: string, exceptId: number | null): boolean {
      return this.#db.query<{ id: number }, Params>(`
         SELECT id FROM portfolio
         WHERE venue = ? AND account_id = ? AND archived_at IS NULL AND name = ? AND id IS NOT ?`)
         .get(...this.#scope, name, exceptId) !== null
   }

   targets(): PortfolioTargetRow[] {
      return this.#db.query<PortfolioTargetRow, Params>(`
         SELECT portfolio_id AS portfolioId, asset, weight FROM portfolio_target
         WHERE ${activePortfolio}
         ORDER BY portfolio_id, position`).all(...this.#scope)
   }

   createPortfolio({ name, quoteAsset, band, targets }: PortfolioDraft, now = Date.now()): number {
      return this.#db.transaction(() => {
         const { id } = this.#db.query<{ id: number }, Params>(`
            INSERT INTO portfolio (venue, account_id, name, quote_asset, band, created_at)
            VALUES (?, ?, ?, ?, ?, ?) RETURNING id`)
            .get(...this.#scope, name, quoteAsset, band, now)!
         this.#replaceTargets(id, targets)
         return id
      })()
   }

   updatePortfolio(id: number, { name, quoteAsset, band, targets }: PortfolioDraft): void {
      this.#db.transaction(() => {
         this.#db.query<void, Params>(`
            UPDATE portfolio SET name = ?, quote_asset = ?, band = ?
            WHERE id = ? AND venue = ? AND account_id = ?`)
            .run(name, quoteAsset, band, id, ...this.#scope)
         this.#replaceTargets(id, targets)
      })()
   }

   #replaceTargets(portfolioId: number, targets: PortfolioTarget[]): void {
      this.#db.query<void, Params>('DELETE FROM portfolio_target WHERE portfolio_id = ?').run(portfolioId)
      const insert = this.#db.prepare<void, Params>(
         'INSERT INTO portfolio_target (portfolio_id, asset, weight, position) VALUES (?, ?, ?, ?)')
      targets.forEach(({ asset, weight }, position) => insert.run(portfolioId, asset, weight, position))
   }

   archive(id: number, now = Date.now()): boolean {
      const { changes } = this.#db.query<void, Params>(`
         UPDATE portfolio SET archived_at = ?
         WHERE id = ? AND venue = ? AND account_id = ? AND archived_at IS NULL`)
         .run(now, id, ...this.#scope)
      return changes > 0
   }

   hasActivity(portfolioId: number): boolean {
      return this.#db.query<{ found: number }, Params>(`
         SELECT 1 AS found FROM portfolio_movement WHERE portfolio_id = ?
         UNION ALL SELECT 1 AS found FROM portfolio_order WHERE portfolio_id = ?
         LIMIT 1`).get(portfolioId, portfolioId) !== null
   }

   movements(): PortfolioMovementRow[] {
      return this.#db.query<PortfolioMovementRow, Params>(`
         SELECT ${movementColumns} FROM portfolio_movement
         WHERE ${activePortfolio}
         ORDER BY id`).all(...this.#scope)
   }

   orders(): PortfolioOrderRow[] {
      return this.#db.query<PortfolioOrderRow, Params>(`
         SELECT ${orderColumns} FROM portfolio_order
         WHERE ${activePortfolio}
         ORDER BY created_at, seq`).all(...this.#scope)
   }

   addMovement({ portfolioId, kind, asset, amount, value, orderLinkId = null, note = '' }: MovementDraft, now = Date.now()): PortfolioMovementRow {
      return this.#db.query<PortfolioMovementRow, Params>(`
         INSERT INTO portfolio_movement (portfolio_id, kind, asset, amount, value, order_link_id, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING ${movementColumns}`)
         .get(portfolioId, kind, asset, amount, value, orderLinkId, note, now)!
   }

   portfolioMovements(portfolioId: number, limit = 200): PortfolioMovementRow[] {
      return this.#db.query<PortfolioMovementRow, Params>(`
         SELECT ${movementColumns} FROM portfolio_movement
         WHERE portfolio_id = ? AND ${ownedPortfolio}
         ORDER BY id DESC LIMIT ?`).all(portfolioId, ...this.#scope, limit)
   }

   createRun(run: RunDraft, orders: OrderDraft[]): void {
      this.#db.transaction(() => {
         this.#db.query<void, Params>(`
            INSERT INTO portfolio_run (id, portfolio_id, kind, status, withdraw, reserve, slippage, started_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(run.id, run.portfolioId, run.kind, run.status, run.withdraw, run.reserve, run.slippage, run.startedAt)

         const insert = this.#db.prepare<void, Params>(`
            INSERT INTO portfolio_order (order_link_id, run_id, portfolio_id, seq, symbol, side,
               base_asset, quote_asset, unit, requested, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`)

         for (const order of orders) {
            insert.run(order.orderLinkId, run.id, run.portfolioId, order.seq, order.symbol, order.side,
               order.baseAsset, order.quoteAsset, order.unit, order.requested, run.startedAt, run.startedAt)
         }
      })()
   }

   markOrder(orderLinkId: string, fields: { status: RunOrderStatus, orderId?: string | null, requested?: string, error?: string | null }, now = Date.now()): void {
      this.#db.query<void, Params>(`
         UPDATE portfolio_order SET
            status = ?,
            order_id = COALESCE(?, order_id),
            requested = COALESCE(?, requested),
            error = ?,
            updated_at = ?
         WHERE order_link_id = ? AND ${ownedPortfolio}`)
         .run(fields.status, fields.orderId ?? null, fields.requested ?? null, fields.error ?? null, now,
            orderLinkId, ...this.#scope)
   }

   settleOrder(order: PortfolioOrderRow, outcome: OrderOutcome, fees: FeeAmount[], now = Date.now()): void {
      this.#db.transaction(() => {
         this.#db.query<void, Params>(`
            UPDATE portfolio_order SET
               status = ?, order_id = COALESCE(?, order_id), cum_base = ?, cum_quote = ?,
               avg_price = ?, error = ?, updated_at = ?
            WHERE order_link_id = ? AND ${ownedPortfolio}`)
            .run(outcome.status, outcome.orderId, outcome.base, outcome.quote, outcome.averagePrice,
               outcome.error, now, order.orderLinkId, ...this.#scope)

         this.#db.query<void, Params>('DELETE FROM portfolio_movement WHERE kind = \'fee\' AND order_link_id = ?')
            .run(order.orderLinkId)

         for (const { asset, amount } of fees) {
            this.addMovement({
               portfolioId: order.portfolioId, kind: 'fee', asset, amount: Big(amount).times(-1).toFixed(),
               value: '0', orderLinkId: order.orderLinkId
            }, now)
         }
      })()
   }

   runOrders(runId: string): PortfolioOrderRow[] {
      return this.#db.query<PortfolioOrderRow, Params>(`
         SELECT ${orderColumns} FROM portfolio_order
         WHERE run_id = ? AND ${ownedPortfolio}
         ORDER BY seq`).all(runId, ...this.#scope)
   }

   order(orderLinkId: string): PortfolioOrderRow | null {
      return this.#db.query<PortfolioOrderRow, Params>(`
         SELECT ${orderColumns} FROM portfolio_order
         WHERE order_link_id = ? AND ${ownedPortfolio}`).get(orderLinkId, ...this.#scope)
   }

   unsettledOrders(): PortfolioOrderRow[] {
      return this.#db.query<PortfolioOrderRow, Params>(`
         SELECT ${orderColumns} FROM portfolio_order
         WHERE status IN ${unsettledStatuses} AND ${ownedPortfolio}
         ORDER BY created_at, seq`).all(...this.#scope)
   }

   run(runId: string): PortfolioRunRow | null {
      return this.#db.query<PortfolioRunRow, Params>(`
         SELECT ${runColumns} FROM portfolio_run
         WHERE id = ? AND ${ownedPortfolio}`).get(runId, ...this.#scope)
   }

   runs(portfolioId: number, limit = 20): PortfolioRunRow[] {
      return this.#db.query<PortfolioRunRow, Params>(`
         SELECT ${runColumns} FROM portfolio_run
         WHERE portfolio_id = ? AND ${ownedPortfolio}
         ORDER BY started_at DESC LIMIT ?`).all(portfolioId, ...this.#scope, limit)
   }

   runningRuns(): PortfolioRunRow[] {
      return this.#db.query<PortfolioRunRow, Params>(`
         SELECT ${runColumns} FROM portfolio_run
         WHERE status = 'running' AND ${ownedPortfolio}`).all(...this.#scope)
   }

   finishRun(runId: string, status: RunStatus, withdrawn: string, error: string | null, now = Date.now()): void {
      this.#db.query<void, Params>(`
         UPDATE portfolio_run SET status = ?, withdrawn = ?, error = ?, finished_at = ?
         WHERE id = ? AND ${ownedPortfolio}`)
         .run(status, withdrawn, error, now, runId, ...this.#scope)
   }

   feesByOrder(orderLinkIds: string[]): Map<string, FeeAmount[]> {
      const fees = new Map<string, FeeAmount[]>()
      if (orderLinkIds.length === 0) return fees

      const rows = this.#db.query<{ orderLinkId: string, asset: string, amount: string }, Params>(`
         SELECT order_link_id AS orderLinkId, asset, amount FROM portfolio_movement
         WHERE kind = 'fee' AND order_link_id IN (${orderLinkIds.map(() => '?').join(', ')})
            AND ${ownedPortfolio}`).all(...orderLinkIds, ...this.#scope)

      for (const { orderLinkId, asset, amount } of rows) {
         fees.set(orderLinkId, [...fees.get(orderLinkId) ?? [], { asset, amount: Big(amount).times(-1).toFixed() }])
      }
      return fees
   }
}
