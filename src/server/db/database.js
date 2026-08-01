import { Database } from 'bun:sqlite'
import { resolveDbPath } from './paths.js'

let database = null

// Each entry adds one schema version. Never edit an applied migration, append a new one.
const migrations = [

   // v1 — ledger entries and per-account sync state
   db => db.exec(`
      CREATE TABLE ledger_entry (
         account_id  TEXT    NOT NULL,
         entry_key   TEXT    NOT NULL,
         txid        TEXT    NOT NULL DEFAULT '',
         refid       TEXT    NOT NULL DEFAULT '',
         time        INTEGER NOT NULL,
         type        TEXT    NOT NULL,
         subtype     TEXT    NOT NULL DEFAULT '',
         aclass      TEXT    NOT NULL DEFAULT '',
         asset       TEXT    NOT NULL,
         base_asset  TEXT    NOT NULL,
         wallet      TEXT    NOT NULL DEFAULT '',
         amount      TEXT    NOT NULL,
         fee         TEXT    NOT NULL,
         balance     TEXT    NOT NULL DEFAULT '',
         amount_num  REAL    NOT NULL,
         synced_at   INTEGER NOT NULL,
         PRIMARY KEY (account_id, entry_key)
      ) STRICT;

      CREATE INDEX idx_entry_account_time  ON ledger_entry (account_id, time DESC, entry_key DESC);
      CREATE INDEX idx_entry_account_asset ON ledger_entry (account_id, base_asset, time DESC);
      CREATE INDEX idx_entry_account_refid ON ledger_entry (account_id, refid);

      CREATE TABLE sync_state (
         account_id      TEXT PRIMARY KEY,
         api_key_prefix  TEXT NOT NULL DEFAULT '',
         covered_from    INTEGER,
         covered_to      INTEGER,
         first_synced_at INTEGER,
         last_synced_at  INTEGER,
         last_report_id  TEXT,
         last_error      TEXT
      ) STRICT;
   `)
]

function migrate(db) {
   const { user_version: version } = db.query('PRAGMA user_version').get()
   if (version >= migrations.length) return

   db.transaction(() => {
      for (let v = version; v < migrations.length; v++) {
         console.log(`Applying ledger database migration v${v + 1}`)
         migrations[v](db)
      }
      // PRAGMA values cannot be bound, but this one is a length we control.
      db.exec(`PRAGMA user_version = ${migrations.length}`)
   })()
}

// Opened lazily so that importing a route never creates a database file.
export function getDatabase() {
   if (database) return database

   const dbPath = resolveDbPath()
   console.log('Opening ledger database:', dbPath)

   const db = new Database(dbPath, { create: true })

   // WAL lets the entries and status queries read while a sync writes.
   db.exec('PRAGMA journal_mode = WAL')
   db.exec('PRAGMA synchronous = NORMAL')
   db.exec('PRAGMA busy_timeout = 5000')

   migrate(db)

   database = db
   return database
}
