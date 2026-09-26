import { Database } from 'bun:sqlite'
import { resolveDbPath } from './paths'
import type { UserVersionRow } from '../../types/db'

type Migration = (db: Database) => void

let database: Database | null = null

// Each entry adds one schema version. Never edit an applied migration, append a new one.
const migrations: Migration[] = [

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
   `),

   // v2 — trades, from Kraken's second export report. The ledger export carries no
   // order id, so orders can only be rebuilt from here: a trade's txid is the refid
   // the ledger entries of that trade already share.
   db => db.exec(`
      CREATE TABLE trade (
         account_id  TEXT    NOT NULL,
         txid        TEXT    NOT NULL,
         ordertxid   TEXT    NOT NULL DEFAULT '',
         order_key   TEXT    NOT NULL,
         pair        TEXT    NOT NULL DEFAULT '',
         pair_key    TEXT    NOT NULL DEFAULT '',
         base_asset  TEXT    NOT NULL DEFAULT '',
         quote_asset TEXT    NOT NULL DEFAULT '',
         time        INTEGER NOT NULL,
         type        TEXT    NOT NULL DEFAULT '',
         ordertype   TEXT    NOT NULL DEFAULT '',
         price       TEXT    NOT NULL,
         cost        TEXT    NOT NULL,
         fee         TEXT    NOT NULL,
         vol         TEXT    NOT NULL,
         margin      TEXT    NOT NULL DEFAULT '0',
         misc        TEXT    NOT NULL DEFAULT '',
         price_num   REAL    NOT NULL,
         cost_num    REAL    NOT NULL,
         fee_num     REAL    NOT NULL,
         vol_num     REAL    NOT NULL,
         synced_at   INTEGER NOT NULL,
         PRIMARY KEY (account_id, txid)
      ) STRICT;

      CREATE INDEX idx_trade_account_order ON trade (account_id, order_key);
      CREATE INDEX idx_trade_account_time  ON trade (account_id, time DESC, txid DESC);
      CREATE INDEX idx_trade_account_pair  ON trade (account_id, pair_key, time DESC);

      ALTER TABLE sync_state ADD COLUMN trades_covered_from INTEGER;
      ALTER TABLE sync_state ADD COLUMN trades_covered_to   INTEGER;
   `),

   db => db.exec(`
      CREATE TABLE xstock_listing (
         ticker        TEXT    NOT NULL PRIMARY KEY,
         altname       TEXT    NOT NULL,
         name          TEXT    NOT NULL DEFAULT '',
         exchange      TEXT    NOT NULL DEFAULT '',
         type          TEXT    NOT NULL DEFAULT 'unknown',
         subtype       TEXT    NOT NULL DEFAULT '',
         confidence    TEXT    NOT NULL DEFAULT '',
         sources       TEXT    NOT NULL DEFAULT '',
         origin        TEXT    NOT NULL DEFAULT 'ai',
         classified_at INTEGER NOT NULL
      ) STRICT;

      CREATE TABLE xstock_description (
         ticker       TEXT    NOT NULL,
         word_count   INTEGER NOT NULL,
         description  TEXT    NOT NULL,
         sources      TEXT    NOT NULL DEFAULT '',
         model        TEXT    NOT NULL DEFAULT '',
         generated_at INTEGER NOT NULL,
         PRIMARY KEY (ticker, word_count)
      ) STRICT;
   `),

   db => db.exec(`
      CREATE TABLE portfolio (
         id           INTEGER NOT NULL PRIMARY KEY,
         venue        TEXT    NOT NULL,
         account_id   TEXT    NOT NULL,
         name         TEXT    NOT NULL,
         quote_asset  TEXT    NOT NULL,
         band         TEXT    NOT NULL,
         created_at   INTEGER NOT NULL,
         archived_at  INTEGER
      ) STRICT;

      CREATE UNIQUE INDEX portfolio_active_name
         ON portfolio (venue, account_id, name) WHERE archived_at IS NULL;

      CREATE TABLE portfolio_target (
         portfolio_id INTEGER NOT NULL,
         asset        TEXT    NOT NULL,
         weight       TEXT    NOT NULL,
         position     INTEGER NOT NULL,
         PRIMARY KEY (portfolio_id, asset)
      ) STRICT;

      CREATE TABLE portfolio_movement (
         id            INTEGER NOT NULL PRIMARY KEY,
         portfolio_id  INTEGER NOT NULL,
         kind          TEXT    NOT NULL CHECK (kind IN ('deposit', 'withdraw', 'adjust', 'fee')),
         asset         TEXT    NOT NULL,
         amount        TEXT    NOT NULL,
         value         TEXT    NOT NULL,
         order_link_id TEXT,
         note          TEXT    NOT NULL DEFAULT '',
         created_at    INTEGER NOT NULL
      ) STRICT;

      CREATE INDEX portfolio_movement_portfolio ON portfolio_movement (portfolio_id);
      CREATE INDEX portfolio_movement_order ON portfolio_movement (order_link_id);

      CREATE TABLE portfolio_run (
         id           TEXT    NOT NULL PRIMARY KEY,
         portfolio_id INTEGER NOT NULL,
         kind         TEXT    NOT NULL CHECK (kind IN ('rebalance', 'withdraw')),
         status       TEXT    NOT NULL,
         withdraw     TEXT    NOT NULL,
         withdrawn    TEXT    NOT NULL DEFAULT '0',
         reserve      TEXT    NOT NULL,
         slippage     TEXT    NOT NULL,
         error        TEXT,
         started_at   INTEGER NOT NULL,
         finished_at  INTEGER
      ) STRICT;

      CREATE INDEX portfolio_run_portfolio ON portfolio_run (portfolio_id, started_at);

      CREATE TABLE portfolio_order (
         order_link_id TEXT    NOT NULL PRIMARY KEY,
         run_id        TEXT    NOT NULL,
         portfolio_id  INTEGER NOT NULL,
         seq           INTEGER NOT NULL,
         symbol        TEXT    NOT NULL,
         side          TEXT    NOT NULL CHECK (side IN ('buy', 'sell')),
         base_asset    TEXT    NOT NULL,
         quote_asset   TEXT    NOT NULL,
         unit          TEXT    NOT NULL CHECK (unit IN ('base', 'quote')),
         requested     TEXT    NOT NULL,
         order_id      TEXT,
         status        TEXT    NOT NULL,
         cum_base      TEXT    NOT NULL DEFAULT '0',
         cum_quote     TEXT    NOT NULL DEFAULT '0',
         avg_price     TEXT    NOT NULL DEFAULT '0',
         error         TEXT,
         created_at    INTEGER NOT NULL,
         updated_at    INTEGER NOT NULL
      ) STRICT;

      CREATE INDEX portfolio_order_run ON portfolio_order (run_id, seq);
      CREATE INDEX portfolio_order_portfolio ON portfolio_order (portfolio_id);
   `),

   db => db.exec(`
      ALTER TABLE portfolio_target ADD COLUMN stop_price TEXT;

      CREATE TABLE portfolio_stop (
         order_link_id   TEXT    NOT NULL PRIMARY KEY,
         portfolio_id    INTEGER NOT NULL,
         asset           TEXT    NOT NULL,
         symbol          TEXT    NOT NULL,
         quantity        TEXT    NOT NULL,
         trigger_price   TEXT    NOT NULL,
         order_id        TEXT,
         status          TEXT    NOT NULL,
         error           TEXT,
         placed_at       INTEGER NOT NULL,
         updated_at      INTEGER NOT NULL,
         settled_at      INTEGER,
         acknowledged_at INTEGER
      ) STRICT;

      CREATE INDEX portfolio_stop_portfolio ON portfolio_stop (portfolio_id, asset);

      CREATE UNIQUE INDEX portfolio_stop_live ON portfolio_stop (portfolio_id, asset)
         WHERE status IN ('pending', 'placed');

      CREATE TABLE portfolio_run_next (
         id           TEXT    NOT NULL PRIMARY KEY,
         portfolio_id INTEGER NOT NULL,
         kind         TEXT    NOT NULL CHECK (kind IN ('rebalance', 'withdraw', 'stop')),
         status       TEXT    NOT NULL,
         withdraw     TEXT    NOT NULL,
         withdrawn    TEXT    NOT NULL DEFAULT '0',
         reserve      TEXT    NOT NULL,
         slippage     TEXT    NOT NULL,
         error        TEXT,
         started_at   INTEGER NOT NULL,
         finished_at  INTEGER
      ) STRICT;

      INSERT INTO portfolio_run_next
         (id, portfolio_id, kind, status, withdraw, withdrawn, reserve, slippage, error, started_at, finished_at)
         SELECT id, portfolio_id, kind, status, withdraw, withdrawn, reserve, slippage, error, started_at, finished_at
         FROM portfolio_run;

      DROP TABLE portfolio_run;

      ALTER TABLE portfolio_run_next RENAME TO portfolio_run;

      CREATE INDEX portfolio_run_portfolio ON portfolio_run (portfolio_id, started_at);
   `),

   db => db.exec(`
      CREATE TABLE asset_usd_rate (
         asset  TEXT    NOT NULL,
         day    INTEGER NOT NULL,
         rate   REAL    NOT NULL,
         source TEXT    NOT NULL CHECK (source IN ('kraken-daily', 'kraken-weekly', 'ecb')),
         PRIMARY KEY (asset, day)
      ) STRICT;
   `)
]

function migrate(db: Database) {
   const { user_version: version } = db.query<UserVersionRow, []>('PRAGMA user_version').get()!
   if (version >= migrations.length) return

   db.transaction(() => {
      for (const [index, migration] of migrations.slice(version).entries()) {
         console.log(`Applying ledger database migration v${version + index + 1}`)
         migration(db)
      }
      // PRAGMA values cannot be bound, but this one is a length we control.
      db.exec(`PRAGMA user_version = ${migrations.length}`)
   })()
}

// Opened lazily so that importing a route never creates a database file.
export function getDatabase(): Database {
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

export function closeDatabase(): void {
   database?.close()
   database = null
}
