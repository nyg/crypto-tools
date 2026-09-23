import Big from 'big.js'
import type { Database, SQLQueryBindings } from 'bun:sqlite'
import { getDatabase } from './database'
import type {
   PortfolioMovementRow, PortfolioOrderRow, PortfolioRow, PortfolioRunRow, PortfolioStopRow,
   PortfolioTargetRow
} from '../../types/db'
import type {
   FeeAmount, MovementKind, RunOrderStatus, RunStatus, StopStatus, VenueId
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

export type StopDraft = Pick<PortfolioStopRow,
   'orderLinkId' | 'portfolioId' | 'asset' | 'symbol' | 'quantity' | 'triggerPrice' | 'orderId' | 'status'>
   & { error?: string | null }

export interface StopFill {
   runId: string
   quoteAsset: string
   outcome: OrderOutcome
}

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

const stopColumns = `order_link_id AS orderLinkId, portfolio_id AS portfolioId, asset, symbol,
   quantity, trigger_price AS triggerPrice, order_id AS orderId, status, error,
   placed_at AS placedAt, updated_at AS updatedAt, settled_at AS settledAt,
   acknowledged_at AS acknowledgedAt`

const unsettledStatuses = '(\'pending\', \'placed\', \'unknown\')'

const liveStopStatuses = '(\'pending\', \'placed\')'

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
         SELECT portfolio_id AS portfolioId, asset, weight, stop_price AS stopPrice FROM portfolio_target
         WHERE ${activePortfolio}
         ORDER BY portfolio_id, position`).all(...this.#scope)
   }

   createPortfolio({ name, quoteAsset, band, targets }: PortfolioDraft, now = Date.now()): number {
      return this.#db.transaction(() => {
         const { id } = this.#db.query<{ id: number }, Params>(`
            INSERT INTO portfolio (venue, account_id, name, quote_asset, band, created_at)
            VALUES (?, ?, ?, ?, ?, ?) RETURNING id`)
            .get(...this.#scope, name, quoteAsset, band, now)!
         this.replaceTargets(id, targets)
         return id
      })()
   }

   updatePortfolio(id: number, { name, quoteAsset, band, targets }: PortfolioDraft): void {
      this.#db.transaction(() => {
         this.#db.query<void, Params>(`
            UPDATE portfolio SET name = ?, quote_asset = ?, band = ?
            WHERE id = ? AND venue = ? AND account_id = ?`)
            .run(name, quoteAsset, band, id, ...this.#scope)
         this.replaceTargets(id, targets)
      })()
   }

   replaceTargets(portfolioId: number, targets: PortfolioTarget[]): void {
      this.#db.transaction(() => {
         this.#db.query<void, Params>('DELETE FROM portfolio_target WHERE portfolio_id = ?').run(portfolioId)
         const insert = this.#db.prepare<void, Params>(
            'INSERT INTO portfolio_target (portfolio_id, asset, weight, position, stop_price) VALUES (?, ?, ?, ?, ?)')
         try {
            targets.forEach(({ asset, weight, stopPrice }, position) =>
               insert.run(portfolioId, asset, weight, position, stopPrice ?? null))
         }
         finally {
            insert.finalize()
         }
      })()
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

         try {
            for (const order of orders) {
               insert.run(order.orderLinkId, run.id, run.portfolioId, order.seq, order.symbol, order.side,
                  order.baseAsset, order.quoteAsset, order.unit, order.requested, run.startedAt, run.startedAt)
            }
         }
         finally {
            insert.finalize()
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

   lastRebalances(): Map<number, number> {
      const rows = this.#db.query<{ portfolioId: number, finishedAt: number }, Params>(`
         SELECT portfolio_id AS portfolioId, MAX(finished_at) AS finishedAt FROM portfolio_run AS run
         WHERE kind = 'rebalance' AND finished_at IS NOT NULL AND ${activePortfolio}
            AND EXISTS (SELECT 1 FROM portfolio_order WHERE run_id = run.id AND CAST(cum_base AS REAL) > 0)
         GROUP BY portfolio_id`).all(...this.#scope)
      return new Map(rows.map(({ portfolioId, finishedAt }) => [portfolioId, finishedAt]))
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

   stops(): PortfolioStopRow[] {
      return this.#db.query<PortfolioStopRow, Params>(`
         SELECT ${stopColumns} FROM portfolio_stop
         WHERE ${activePortfolio}
         ORDER BY placed_at`).all(...this.#scope)
   }

   stopsOf(portfolioId: number): PortfolioStopRow[] {
      return this.#db.query<PortfolioStopRow, Params>(`
         SELECT ${stopColumns} FROM portfolio_stop
         WHERE portfolio_id = ? AND ${ownedPortfolio}
         ORDER BY placed_at`).all(portfolioId, ...this.#scope)
   }

   liveStops(): PortfolioStopRow[] {
      return this.#db.query<PortfolioStopRow, Params>(`
         SELECT ${stopColumns} FROM portfolio_stop
         WHERE status IN ${liveStopStatuses} AND ${activePortfolio}
         ORDER BY placed_at`).all(...this.#scope)
   }

   unacknowledgedStops(): PortfolioStopRow[] {
      return this.#db.query<PortfolioStopRow, Params>(`
         SELECT ${stopColumns} FROM portfolio_stop
         WHERE acknowledged_at IS NULL AND status IN ('filled', 'partial') AND ${activePortfolio}
         ORDER BY settled_at`).all(...this.#scope)
   }

   insertStop(draft: StopDraft, now = Date.now()): void {
      this.#db.query<void, Params>(`
         INSERT INTO portfolio_stop (order_link_id, portfolio_id, asset, symbol, quantity,
            trigger_price, order_id, status, error, placed_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
         .run(draft.orderLinkId, draft.portfolioId, draft.asset, draft.symbol, draft.quantity,
            draft.triggerPrice, draft.orderId, draft.status, draft.error ?? null, now, now)
   }

   clearStopFailures(portfolioId: number, asset: string): void {
      this.#db.query<void, Params>(`
         DELETE FROM portfolio_stop
         WHERE portfolio_id = ? AND asset = ? AND status IN ('failed', 'missing') AND ${ownedPortfolio}`)
         .run(portfolioId, asset, ...this.#scope)
   }

   markStop(orderLinkId: string, fields: { status: StopStatus, orderId?: string | null, error?: string | null }, now = Date.now()): void {
      this.#db.query<void, Params>(`
         UPDATE portfolio_stop SET
            status = ?,
            order_id = COALESCE(?, order_id),
            error = ?,
            updated_at = ?,
            settled_at = CASE WHEN ? IN ('filled', 'partial') THEN ? ELSE settled_at END
         WHERE order_link_id = ? AND ${ownedPortfolio}`)
         .run(fields.status, fields.orderId ?? null, fields.error ?? null, now, fields.status, now,
            orderLinkId, ...this.#scope)
   }

   ackStop(orderLinkId: string, now = Date.now()): number {
      const { changes } = this.#db.query<void, Params>(`
         UPDATE portfolio_stop SET acknowledged_at = ?, updated_at = ?
         WHERE order_link_id = ? AND acknowledged_at IS NULL AND ${ownedPortfolio}`)
         .run(now, now, orderLinkId, ...this.#scope)
      return changes
   }

   recordStopFill(stop: PortfolioStopRow, fill: StopFill, fees: FeeAmount[], now = Date.now()): void {
      this.#db.transaction(() => {
         this.createRun({
            id: fill.runId,
            portfolioId: stop.portfolioId,
            kind: 'stop',
            status: 'running',
            withdraw: '0',
            reserve: '0',
            slippage: '0',
            startedAt: now
         }, [{
            orderLinkId: stop.orderLinkId,
            seq: 1,
            symbol: stop.symbol,
            side: 'sell',
            baseAsset: stop.asset,
            quoteAsset: fill.quoteAsset,
            unit: 'base',
            requested: stop.quantity
         }])

         const order = this.order(stop.orderLinkId)!
         this.settleOrder(order, fill.outcome, fees, now)

         const runStatus: RunStatus = fill.outcome.status === 'filled' ? 'done'
            : fill.outcome.status === 'partial' ? 'partial' : 'error'
         this.finishRun(fill.runId, runStatus, '0', fill.outcome.error, now)

         this.markStop(stop.orderLinkId, {
            status: fill.outcome.status === 'filled' ? 'filled' : fill.outcome.status === 'partial' ? 'partial' : 'failed',
            orderId: fill.outcome.orderId,
            error: fill.outcome.error
         }, now)
      })()
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
