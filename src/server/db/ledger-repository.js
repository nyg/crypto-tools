import Big from 'big.js'
import { getDatabase } from './database.js'
import { entryKeyFor } from './entry-key.js'

// Columns the table may be sorted by, mapped to real column names. Anything not in
// here is rejected rather than interpolated into the query.
const sortableColumns = {
   time: 'time',
   amount: 'amount_num',
   asset: 'base_asset',
   type: 'type'
}

// Kraken charges a fee on the row it belongs to, in that row's own asset, so every
// aggregate below stays grouped by base_asset — there is nothing to convert between.
// Fees are stored as the exact decimal strings the export returned; casting to REAL
// is only ever done to add them up for display, never written back to a row.
const nonZeroFee = 'CAST(fee AS REAL) <> 0'

// What Kraken pays out for holding an asset, as opposed to moving it in and out of a
// staking or earn position: the allocation subtypes are transfers between the spot and
// earn wallets, not income, and would otherwise dwarf the rewards themselves.
const isReward = `type IN ('staking', 'earn')
   AND subtype NOT IN ('allocation', 'deallocation', 'autoallocation', 'migration')`

const DAY = 86400000

function lastCompletePeriods(now = Date.now()) {

   const today = new Date(now)
   const [year, month, day] = [today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()]

   const thisWeek = Date.UTC(year, month, day) - ((today.getUTCDay() + 6) % 7) * DAY
   const thisMonth = Date.UTC(year, month, 1)

   return {
      week: { from: thisWeek - 7 * DAY, to: thisWeek - 1 },
      month: { from: Date.UTC(year, month - 1, 1), to: thisMonth - 1 }
   }
}

const upsertStatement = `
   INSERT INTO ledger_entry (
      account_id, entry_key, txid, refid, time, type, subtype, aclass,
      asset, base_asset, wallet, amount, fee, balance, amount_num, synced_at)
   VALUES ($accountId, $entryKey, $txid, $refid, $time, $type, $subtype, $aclass,
      $asset, $baseAsset, $wallet, $amount, $fee, $balance, $amountNum, $syncedAt)
   ON CONFLICT (account_id, entry_key) DO UPDATE SET
      txid = excluded.txid, refid = excluded.refid, time = excluded.time,
      type = excluded.type, subtype = excluded.subtype, aclass = excluded.aclass,
      asset = excluded.asset, base_asset = excluded.base_asset, wallet = excluded.wallet,
      amount = excluded.amount, fee = excluded.fee, balance = excluded.balance,
      amount_num = excluded.amount_num, synced_at = excluded.synced_at`

export default function LedgerRepository(accountId) {

   const db = getDatabase()

   // Every statement below is scoped by account_id so that two Kraken accounts
   // stored side by side can never read or overwrite each other's entries.

   this.upsertEntries = function (entries, syncedAt) {

      const insert = db.prepare(upsertStatement)

      db.transaction(() => {
         for (const entry of entries) {
            insert.run({
               $accountId: accountId,
               $entryKey: entryKeyFor(entry),
               $txid: entry.txid,
               $refid: entry.refid,
               $time: entry.time,
               $type: entry.type,
               $subtype: entry.subtype,
               $aclass: entry.aclass,
               $asset: entry.asset,
               $baseAsset: entry.baseAsset,
               $wallet: entry.wallet,
               $amount: entry.amount,
               $fee: entry.fee,
               $balance: entry.balance,
               $amountNum: Number(entry.amount),
               $syncedAt: syncedAt
            })
         }
      })()
   }

   this.countEntries = function () {
      return db.query('SELECT COUNT(*) AS count FROM ledger_entry WHERE account_id = ?')
         .get(accountId).count
   }

   this.entryTimeRange = function () {
      const range = db.query(`
         SELECT MIN(time) AS first, MAX(time) AS last
         FROM ledger_entry WHERE account_id = ?`).get(accountId)
      return { first: range.first ?? null, last: range.last ?? null }
   }

   this.queryEntries = function ({ filters = {}, sort = {}, page = 0, pageSize = 50 }) {

      const { where, params } = buildWhere(accountId, filters)

      const column = sortableColumns[sort.column] ?? 'time'
      const direction = sort.direction === 'asc' ? 'ASC' : 'DESC'

      const total = db.query(`SELECT COUNT(*) AS count FROM ledger_entry WHERE ${where}`)
         .get(...params).count

      // Kraken timestamps only have second resolution and many entries share one, so
      // entry_key breaks ties. Without it rows shuffle between pages.
      const rows = db.query(`
         SELECT txid, refid, time, type, subtype, asset, base_asset AS baseAsset,
                wallet, amount, fee, balance
         FROM ledger_entry
         WHERE ${where}
         ORDER BY ${column} ${direction}, entry_key ${direction}
         LIMIT ? OFFSET ?`).all(...params, pageSize, page * pageSize)

      return { rows, total, page, pageSize }
   }

   this.distinctFilters = function () {
      const column = name => db
         .query(`SELECT DISTINCT ${name} AS value FROM ledger_entry
                 WHERE account_id = ? AND ${name} <> '' ORDER BY value`)
         .all(accountId).map(row => row.value)

      return { assets: column('base_asset'), types: column('type'), wallets: column('wallet') }
   }

   this.feeSummary = function (filters = {}) {

      const built = buildWhere(accountId, filters)
      const where = `${built.where} AND ${nonZeroFee}`
      const params = built.params

      const assets = db.query(`
         SELECT base_asset AS asset, SUM(CAST(fee AS REAL)) AS total, COUNT(*) AS entries
         FROM ledger_entry
         WHERE ${where}
         GROUP BY base_asset
         ORDER BY entries DESC, asset`).all(...params)

      const byType = db.query(`
         SELECT base_asset AS asset, type, SUM(CAST(fee AS REAL)) AS total, COUNT(*) AS entries
         FROM ledger_entry
         WHERE ${where}
         GROUP BY base_asset, type
         ORDER BY entries DESC`).all(...params)

      // Months are the finest bucket returned; quarters and years are rolled up from
      // them on the page, so changing the granularity costs no request.
      // time is in milliseconds, and integer division by 1000 gives the seconds
      // strftime expects; 'unixepoch' keeps the bucket in UTC like every other date here.
      const byMonth = db.query(`
         SELECT strftime('%Y-%m', time / 1000, 'unixepoch') AS month,
                base_asset AS asset, type,
                SUM(CAST(fee AS REAL)) AS total, COUNT(*) AS entries
         FROM ledger_entry
         WHERE ${where}
         GROUP BY month, base_asset, type
         ORDER BY month`).all(...params)

      return {
         assets,
         byType,
         byMonth,
         entries: assets.reduce((count, asset) => count + asset.entries, 0)
      }
   }

   // One row per asset and year, reshaped into the pivot the page draws. Amounts are
   // net of the fee, like every other total here, and the year is taken in UTC to match
   // the timestamps Kraken writes.
   this.rewardSummary = function () {

      const rows = db.query(`
         SELECT base_asset AS asset,
                CAST(strftime('%Y', time / 1000, 'unixepoch') AS INTEGER) AS year,
                SUM(CAST(amount AS REAL) - CAST(fee AS REAL)) AS total,
                COUNT(*) AS entries,
                MIN(time) AS first, MAX(time) AS last
         FROM ledger_entry
         WHERE account_id = ? AND ${isReward}
         GROUP BY asset, year
         ORDER BY asset, year`).all(accountId)

      const assets = new Map()

      for (const row of rows) {
         const asset = assets.get(row.asset)
            ?? { asset: row.asset, total: 0, entries: 0, first: row.first, last: row.last, byYear: {} }

         asset.byYear[row.year] = (asset.byYear[row.year] ?? 0) + row.total
         asset.total += row.total
         asset.entries += row.entries
         asset.first = Math.min(asset.first, row.first)
         asset.last = Math.max(asset.last, row.last)
         assets.set(row.asset, asset)
      }

      const years = [...new Set(rows.map(row => row.year))].toSorted((a, b) => a - b)

      const periodQuery = db.query(`
         SELECT base_asset AS asset,
                SUM(CAST(amount AS REAL) - CAST(fee AS REAL)) AS total,
                COUNT(*) AS entries
         FROM ledger_entry
         WHERE account_id = ? AND ${isReward} AND time >= ? AND time <= ?
         GROUP BY asset
         ORDER BY asset`)

      const periods = Object.fromEntries(Object.entries(lastCompletePeriods())
         .map(([name, { from, to }]) =>
            [name, { from, to, assets: periodQuery.all(accountId, from, to) }]))

      return {
         years,
         periods,
         assets: [...assets.values()],
         entries: rows.reduce((count, row) => count + row.entries, 0),
         first: rows.length > 0 ? Math.min(...rows.map(row => row.first)) : null,
         last: rows.length > 0 ? Math.max(...rows.map(row => row.last)) : null
      }
   }

   // What is held right now, per asset and per wallet, rebuilt from the entries
   // themselves rather than read off Kraken's running balance column: that column is
   // only ever a snapshot of the last row written for a wallet, and says nothing about
   // an asset whose most recent entry was somewhere else.
   //
   // Kraken's own running balance is what this was checked against — summing
   // amount - fee per (asset, wallet) reproduces it to the last digit for every asset
   // in the database, which is why the fold below is done with Big rather than the
   // REAL mirrors the fee and reward summaries use. A balance is compared against
   // Kraken by eye; a rounding artefact in the eighth decimal would look like a bug.
   this.balanceSummary = function () {

      const amounts = db.query(`
         SELECT base_asset AS baseAsset, wallet, asset AS rawAsset, amount, fee
         FROM ledger_entry WHERE account_id = ?`).all(accountId)

      const positions = new Map()
      const keyFor = row => `${row.baseAsset} ${row.wallet}`

      for (const row of amounts) {
         const position = positions.get(keyFor(row))
            ?? { asset: row.baseAsset, wallet: row.wallet, amount: Big(0), rawAssets: new Set() }

         position.amount = position.amount.plus(row.amount || 0).minus(row.fee || 0)
         position.rawAssets.add(row.rawAsset)
         positions.set(keyFor(row), position)
      }

      // Counted separately from the fold: the row count and the first and last time an
      // asset moved are what SQLite is good at, and neither needs exact arithmetic.
      for (const row of db.query(`
         SELECT base_asset AS baseAsset, wallet, COUNT(*) AS entries,
                MIN(time) AS first, MAX(time) AS last
         FROM ledger_entry WHERE account_id = ?
         GROUP BY base_asset, wallet`).all(accountId)) {
         const position = positions.get(keyFor(row))
         if (position) Object.assign(position, { entries: row.entries, first: row.first, last: row.last })
      }

      // When a wallet last paid out. Kraken now pays Auto Earn rewards straight into
      // the spot wallet instead of moving the coins, so this is the only thing that
      // tells a spot position that earns from one that just sits there.
      for (const row of db.query(`
         SELECT base_asset AS baseAsset, wallet, MAX(time) AS lastRewardAt,
                COUNT(*) AS rewardEntries
         FROM ledger_entry
         WHERE account_id = ? AND ${isReward}
         GROUP BY base_asset, wallet`).all(accountId)) {
         const position = positions.get(keyFor(row))
         if (position) Object.assign(position, { lastRewardAt: row.lastRewardAt, rewardEntries: row.rewardEntries })
      }

      const assets = new Map()

      for (const position of positions.values()) {

         // An exactly zero position is one that was closed, not a dust holding: the
         // coins left, and listing it would bury the assets that are still held.
         if (position.amount.eq(0)) continue

         const asset = assets.get(position.asset)
            ?? { asset: position.asset, total: Big(0), positions: [] }

         asset.total = asset.total.plus(position.amount)
         asset.positions.push({
            wallet: position.wallet,
            amount: position.amount.toFixed(),
            amountNum: Number(position.amount),
            // Sorted so that the plain ticker leads and a legacy staking name (DOT.S)
            // reads as the footnote it is.
            rawAssets: [...position.rawAssets].toSorted(),
            entries: position.entries ?? 0,
            first: position.first ?? null,
            last: position.last ?? null,
            lastRewardAt: position.lastRewardAt ?? null,
            rewardEntries: position.rewardEntries ?? 0
         })
         assets.set(position.asset, asset)
      }

      const range = this.entryTimeRange()
      const held = [...assets.values()]

      return {
         assets: held.map(asset => ({
            asset: asset.asset,
            total: asset.total.toFixed(),
            totalNum: Number(asset.total),
            positions: asset.positions.toSorted((a, b) => b.amountNum - a.amountNum)
         })),
         positions: held.reduce((count, asset) => count + asset.positions.length, 0),
         entries: amounts.length,
         first: range.first,
         last: range.last
      }
   }

   this.readSyncState = function () {
      return db.query(`
         SELECT account_id AS accountId, api_key_prefix AS apiKeyPrefix,
                covered_from AS coveredFrom, covered_to AS coveredTo,
                trades_covered_from AS tradesCoveredFrom, trades_covered_to AS tradesCoveredTo,
                first_synced_at AS firstSyncedAt, last_synced_at AS lastSyncedAt,
                last_report_id AS lastReportId, last_error AS lastError
         FROM sync_state WHERE account_id = ?`).get(accountId) ?? null
   }

   this.writeSyncState = function (values) {
      const current = this.readSyncState() ?? {}
      const merged = { ...current, ...values }

      db.query(`
         INSERT INTO sync_state (account_id, api_key_prefix, covered_from, covered_to,
                                 trades_covered_from, trades_covered_to,
                                 first_synced_at, last_synced_at, last_report_id, last_error)
         VALUES ($accountId, $apiKeyPrefix, $coveredFrom, $coveredTo,
                 $tradesCoveredFrom, $tradesCoveredTo,
                 $firstSyncedAt, $lastSyncedAt, $lastReportId, $lastError)
         ON CONFLICT (account_id) DO UPDATE SET
            api_key_prefix = excluded.api_key_prefix,
            covered_from = excluded.covered_from, covered_to = excluded.covered_to,
            trades_covered_from = excluded.trades_covered_from,
            trades_covered_to = excluded.trades_covered_to,
            first_synced_at = excluded.first_synced_at, last_synced_at = excluded.last_synced_at,
            last_report_id = excluded.last_report_id, last_error = excluded.last_error`)
         .run({
            $accountId: accountId,
            $apiKeyPrefix: merged.apiKeyPrefix ?? '',
            $coveredFrom: merged.coveredFrom ?? null,
            $coveredTo: merged.coveredTo ?? null,
            $tradesCoveredFrom: merged.tradesCoveredFrom ?? null,
            $tradesCoveredTo: merged.tradesCoveredTo ?? null,
            $firstSyncedAt: merged.firstSyncedAt ?? null,
            $lastSyncedAt: merged.lastSyncedAt ?? null,
            $lastReportId: merged.lastReportId ?? null,
            $lastError: merged.lastError ?? null
         })
   }

   // Trades are cleared alongside the entries: they come from the same sync, for the
   // same account, and leaving them behind would show orders the ledger no longer has.
   // Rows only — the tables and the database file stay, so another account's data
   // survives and the next sync writes into the same schema.
   this.clearAccount = function () {
      const entries = this.countEntries()
      const trades = db.query('SELECT COUNT(*) AS count FROM trade WHERE account_id = ?')
         .get(accountId).count

      db.transaction(() => {
         db.query('DELETE FROM ledger_entry WHERE account_id = ?').run(accountId)
         db.query('DELETE FROM trade WHERE account_id = ?').run(accountId)
         db.query('DELETE FROM sync_state WHERE account_id = ?').run(accountId)
      })()

      // Deleting rows only frees pages for reuse, so the file keeps its size and the
      // sync card would still report a 40 MB database after clearing everything out
      // of it. VACUUM rewrites the file at its real size; it cannot run inside a
      // transaction, hence after the one above rather than in it.
      db.exec('VACUUM')

      return { entries, trades }
   }

   // Entries belong to whichever API key downloaded them, so rotating a key leaves
   // the previous rows behind. They are surfaced rather than silently kept.
   this.otherAccounts = function () {
      return db.query(`
         SELECT s.account_id AS accountId, s.api_key_prefix AS apiKeyPrefix,
                (SELECT COUNT(*) FROM ledger_entry e WHERE e.account_id = s.account_id) AS entryCount
         FROM sync_state s
         WHERE s.account_id <> ?`).all(accountId)
   }
}

function buildWhere(accountId, filters) {

   const conditions = ['account_id = ?']
   const params = [accountId]

   // Conditions are only added when set: a fixed chain of "(? IS NULL OR col = ?)"
   // tests would stop SQLite from using the indexes.
   if (filters.asset) {
      conditions.push('base_asset = ?')
      params.push(filters.asset)
   }
   if (filters.type) {
      conditions.push('type = ?')
      params.push(filters.type)
   }
   if (filters.wallet) {
      conditions.push('wallet = ?')
      params.push(filters.wallet)
   }
   if (filters.from) {
      conditions.push('time >= ?')
      params.push(filters.from)
   }
   if (filters.to) {
      conditions.push('time <= ?')
      params.push(filters.to)
   }
   if (filters.search) {
      conditions.push('(txid LIKE ? OR refid LIKE ?)')
      params.push(`%${filters.search}%`, `%${filters.search}%`)
   }

   return { where: conditions.join(' AND '), params }
}
