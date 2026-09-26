import type { Database, SQLQueryBindings } from 'bun:sqlite'
import { getDatabase } from './database'
import type { AssetRangeRow, CountRow, UsdRateRow } from '../../types/db'

type Params = SQLQueryBindings[]
type NamedParams = Record<string, string | number | bigint | boolean | null>

const upsertStatement = `
   INSERT INTO asset_usd_rate (asset, day, rate, source)
   VALUES ($asset, $day, $rate, $source)
   ON CONFLICT (asset, day) DO UPDATE SET
      rate = excluded.rate, source = excluded.source`

export default class RateRepository {

   readonly #db: Database

   constructor() {
      this.#db = getDatabase()
   }

   upsertRates(rows: UsdRateRow[]): number {

      const insert = this.#db.prepare<void, NamedParams>(upsertStatement)

      try {
         this.#db.transaction(() => {
            for (const row of rows) {
               insert.run({ $asset: row.asset, $day: row.day, $rate: row.rate, $source: row.source })
            }
         })()
      }
      finally {
         insert.finalize()
      }

      return rows.length
   }

   coverage(assets: string[]): Map<string, AssetRangeRow> {

      if (assets.length === 0) return new Map()

      const rows = this.#db.query<AssetRangeRow, Params>(`
         SELECT asset, MIN(day) AS first, MAX(day) AS last
         FROM asset_usd_rate
         WHERE asset IN (${assets.map(() => '?').join(', ')})
         GROUP BY asset`).all(...assets)

      return new Map(rows.map(row => [row.asset, row]))
   }

   countRates(): number {
      return this.#db.query<CountRow, Params>('SELECT COUNT(*) AS count FROM asset_usd_rate').get()!.count
   }
}
