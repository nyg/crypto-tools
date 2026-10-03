import type { Database, SQLQueryBindings } from 'bun:sqlite'
import { getDatabase } from './database'
import type { FundingMovement } from '../../types/api'
import type { FundingAccountRow, FundingMovementRow, TimeRow } from '../../types/db'
import type { FundingRecord, FundingVenueId } from '../../types/funding'

type Params = SQLQueryBindings[]
type NamedParams = Record<string, string | number | bigint | boolean | null>

const upsertStatement = `
   INSERT INTO funding_movement (
      venue, account_id, feed, movement_id, kind, asset, amount, fee, method, status, time, synced_at)
   VALUES ($venue, $accountId, $feed, $movementId, $kind, $asset, $amount, $fee, $method, $status, $time, $syncedAt)
   ON CONFLICT (venue, account_id, feed, movement_id) DO UPDATE SET
      kind = excluded.kind, asset = excluded.asset, amount = excluded.amount, fee = excluded.fee,
      method = excluded.method, status = excluded.status, time = excluded.time, synced_at = excluded.synced_at`

export function fundingAccountOf(venue: FundingVenueId, keyId: string): FundingAccountRow | null {
   return getDatabase().query<FundingAccountRow, Params>(`
      SELECT account_id AS accountId, last_synced_at AS lastSyncedAt
      FROM funding_account WHERE venue = ? AND key_id = ?`).get(venue, keyId) ?? null
}

export function rememberFundingAccount(venue: FundingVenueId, keyId: string, accountId: string): void {
   getDatabase().query<void, Params>(`
      INSERT INTO funding_account (venue, key_id, account_id) VALUES (?, ?, ?)
      ON CONFLICT (venue, key_id) DO UPDATE SET account_id = excluded.account_id`).run(venue, keyId, accountId)
}

export default class FundingRepository {

   readonly #db: Database
   readonly #venue: FundingVenueId
   readonly #accountId: string

   constructor(venue: FundingVenueId, accountId: string) {
      this.#db = getDatabase()
      this.#venue = venue
      this.#accountId = accountId
   }

   upsert(feed: string, records: FundingRecord[], syncedAt: number): void {

      const insert = this.#db.prepare<void, NamedParams>(upsertStatement)

      try {
         this.#db.transaction(() => {
            for (const record of records) {
               insert.run({
                  $venue: this.#venue,
                  $accountId: this.#accountId,
                  $feed: feed,
                  $movementId: record.id,
                  $kind: record.kind,
                  $asset: record.asset,
                  $amount: record.amount,
                  $fee: record.fee,
                  $method: record.method,
                  $status: record.status,
                  $time: record.time,
                  $syncedAt: syncedAt
               })
            }
         })()
      }
      finally {
         insert.finalize()
      }
   }

   movements(): FundingMovement[] {
      return this.#db.query<FundingMovementRow, Params>(`
         SELECT feed, movement_id AS movementId, kind, asset, amount, fee, method, status, time
         FROM funding_movement
         WHERE venue = ? AND account_id = ? AND status <> 'failed'
         ORDER BY time, feed, movement_id`).all(this.#venue, this.#accountId)
         .map(({ feed, movementId, status, ...movement }) =>
            ({ id: `${feed}:${movementId}`, ...movement, pending: status === 'pending' }))
   }

   coveredTo(feed: string): number | null {
      return this.#db.query<TimeRow, Params>(`
         SELECT covered_to AS time FROM funding_feed
         WHERE venue = ? AND account_id = ? AND feed = ?`).get(this.#venue, this.#accountId, feed)?.time ?? null
   }

   setCoveredTo(feed: string, coveredTo: number): void {
      this.#db.query<void, Params>(`
         INSERT INTO funding_feed (venue, account_id, feed, covered_to) VALUES (?, ?, ?, ?)
         ON CONFLICT (venue, account_id, feed) DO UPDATE SET covered_to = excluded.covered_to`)
         .run(this.#venue, this.#accountId, feed, coveredTo)
   }

   earliestPending(feed: string, since: number): number | null {
      return this.#db.query<TimeRow, Params>(`
         SELECT MIN(time) AS time FROM funding_movement
         WHERE venue = ? AND account_id = ? AND feed = ? AND status = 'pending' AND time >= ?`)
         .get(this.#venue, this.#accountId, feed, since)?.time ?? null
   }

   markSynced(syncedAt: number): void {
      this.#db.query<void, Params>(`
         UPDATE funding_account SET last_synced_at = ?
         WHERE venue = ? AND account_id = ?`).run(syncedAt, this.#venue, this.#accountId)
   }
}
