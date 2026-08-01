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

   this.summaryRows = function (filters = {}) {
      const { where, params } = buildWhere(accountId, filters)
      return db.query(`
         SELECT base_asset AS baseAsset, type, subtype, amount, fee
         FROM ledger_entry WHERE ${where}`).all(...params)
   }

   // The newest entry per asset and wallet carries the running balance Kraken
   // reported at that point, which is the closest thing the export has to a balance.
   this.latestBalances = function () {
      return db.query(`
         SELECT baseAsset, wallet, balance, time FROM (
            SELECT base_asset AS baseAsset, wallet, balance, time,
                   ROW_NUMBER() OVER (
                      PARTITION BY asset, wallet ORDER BY time DESC, entry_key DESC) AS position
            FROM ledger_entry
            WHERE account_id = ? AND balance <> '')
         WHERE position = 1`).all(accountId)
   }

   this.distinctFilters = function () {
      const column = name => db
         .query(`SELECT DISTINCT ${name} AS value FROM ledger_entry
                 WHERE account_id = ? AND ${name} <> '' ORDER BY value`)
         .all(accountId).map(row => row.value)

      return { assets: column('base_asset'), types: column('type'), wallets: column('wallet') }
   }

   this.readSyncState = function () {
      return db.query(`
         SELECT account_id AS accountId, api_key_prefix AS apiKeyPrefix,
                covered_from AS coveredFrom, covered_to AS coveredTo,
                first_synced_at AS firstSyncedAt, last_synced_at AS lastSyncedAt,
                last_report_id AS lastReportId, last_error AS lastError
         FROM sync_state WHERE account_id = ?`).get(accountId) ?? null
   }

   this.writeSyncState = function (values) {
      const current = this.readSyncState() ?? {}
      const merged = { ...current, ...values }

      db.query(`
         INSERT INTO sync_state (account_id, api_key_prefix, covered_from, covered_to,
                                 first_synced_at, last_synced_at, last_report_id, last_error)
         VALUES ($accountId, $apiKeyPrefix, $coveredFrom, $coveredTo,
                 $firstSyncedAt, $lastSyncedAt, $lastReportId, $lastError)
         ON CONFLICT (account_id) DO UPDATE SET
            api_key_prefix = excluded.api_key_prefix,
            covered_from = excluded.covered_from, covered_to = excluded.covered_to,
            first_synced_at = excluded.first_synced_at, last_synced_at = excluded.last_synced_at,
            last_report_id = excluded.last_report_id, last_error = excluded.last_error`)
         .run({
            $accountId: accountId,
            $apiKeyPrefix: merged.apiKeyPrefix ?? '',
            $coveredFrom: merged.coveredFrom ?? null,
            $coveredTo: merged.coveredTo ?? null,
            $firstSyncedAt: merged.firstSyncedAt ?? null,
            $lastSyncedAt: merged.lastSyncedAt ?? null,
            $lastReportId: merged.lastReportId ?? null,
            $lastError: merged.lastError ?? null
         })
   }

   this.clearAccount = function () {
      const deleted = this.countEntries()
      db.transaction(() => {
         db.query('DELETE FROM ledger_entry WHERE account_id = ?').run(accountId)
         db.query('DELETE FROM sync_state WHERE account_id = ?').run(accountId)
      })()
      return deleted
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
