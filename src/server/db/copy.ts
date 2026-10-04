import { Database } from 'bun:sqlite'
import { closeSync, existsSync, fsyncSync, openSync, renameSync, rmSync } from 'fs'
import type { TableNameRow } from '../../types/db'

export type DatabaseState = 'missing' | 'empty' | 'data'

// Market data and classifications, the same for every account and fetched again on
// demand. Any other table counts as account data, so one added later is never overwritten.
const PUBLIC_TABLES = ['asset_usd_rate', 'xstock_listing', 'xstock_description']

const quoted = (name: string) => `"${name.replaceAll('"', '""')}"`

export function databaseState(file: string): DatabaseState {
   if (!existsSync(file)) return 'missing'

   const db = new Database(file, { readonly: true })

   try {
      const holdsAccountData = db
         .query<TableNameRow, []>('SELECT name FROM sqlite_master WHERE type = \'table\' AND name NOT LIKE \'sqlite_%\'')
         .all()
         .filter(({ name }) => !PUBLIC_TABLES.includes(name))
         .some(({ name }) => db.query(`SELECT 1 FROM ${quoted(name)} LIMIT 1`).get() !== null)

      return holdsAccountData ? 'data' : 'empty'
   }
   finally {
      db.close()
   }
}

export function copyDatabase(from: string, to: string): void {
   const temporary = `${to}.migrating`
   rmSync(temporary, { force: true })

   const source = new Database(from, { readonly: true })

   try {
      source.exec('PRAGMA busy_timeout = 5000')
      // A snapshot read through the WAL, so it carries what is not checkpointed yet and
      // neither blocks nor waits for another process writing to the source.
      source.run('VACUUM INTO ?', [temporary])
   }
   finally {
      source.close()
   }

   // VACUUM INTO writes with synchronous off, and the caller records the copy as done.
   const descriptor = openSync(temporary, 'r+')
   fsyncSync(descriptor)
   closeSync(descriptor)

   // A WAL left beside the old target belongs to that file, and SQLite would replay it
   // into the new one.
   rmSync(`${to}-wal`, { force: true })
   rmSync(`${to}-shm`, { force: true })
   renameSync(temporary, to)
}
