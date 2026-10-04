import { afterAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { copyDatabase, databaseState } from './copy'
import type { CountRow, UserVersionRow } from '../../types/db'

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'crypto-tools-copy-'))
const opened: Database[] = []

const fileNamed = (name: string) => path.join(directory, name)

function open(file: string): Database {
   const db = new Database(file, { create: true })
   db.exec('PRAGMA journal_mode = WAL')
   db.exec('PRAGMA wal_autocheckpoint = 0')
   opened.push(db)
   return db
}

function withSchema(file: string): Database {
   const db = open(file)
   db.exec('CREATE TABLE portfolio (id INTEGER PRIMARY KEY, name TEXT NOT NULL)')
   db.exec('CREATE TABLE asset_usd_rate (asset TEXT NOT NULL, rate REAL NOT NULL)')
   return db
}

function portfolioCount(file: string): number {
   const db = new Database(file, { readonly: true })

   try {
      return db.query<CountRow, []>('SELECT COUNT(*) AS count FROM portfolio').get()!.count
   }
   finally {
      db.close()
   }
}

afterAll(() => {
   for (const db of opened) db.close()
   fs.rmSync(directory, { recursive: true, force: true })
})

describe('the state of a database', () => {

   test('is missing when there is no file', () => {
      expect(databaseState(fileNamed('absent.db'))).toBe('missing')
   })

   test('is empty when it holds only its schema', () => {
      const file = fileNamed('schema-only.db')
      withSchema(file)

      expect(databaseState(file)).toBe('empty')
   })

   test('is empty when only public market data has rows', () => {
      const file = fileNamed('public-only.db')
      withSchema(file).exec('INSERT INTO asset_usd_rate (asset, rate) VALUES (\'EUR\', 1.1)')

      expect(databaseState(file)).toBe('empty')
   })

   test('is data when an account table has a row still in the WAL', () => {
      const file = fileNamed('account-data.db')
      withSchema(file).exec('INSERT INTO portfolio (name) VALUES (\'Core\')')

      expect(fs.statSync(`${file}-wal`).size).toBeGreaterThan(0)
      expect(databaseState(file)).toBe('data')
   })
})

describe('copying a database', () => {

   test('carries the rows the source has not checkpointed yet', () => {
      const from = fileNamed('wal-source.db')
      const to = fileNamed('wal-target.db')
      withSchema(from).exec('INSERT INTO portfolio (name) VALUES (\'Core\'), (\'Satellite\')')

      copyDatabase(from, to)

      expect(portfolioCount(to)).toBe(2)
   })

   test('keeps the schema version', () => {
      const from = fileNamed('versioned-source.db')
      const to = fileNamed('versioned-target.db')
      withSchema(from).exec('PRAGMA user_version = 7')

      copyDatabase(from, to)

      const copy = new Database(to, { readonly: true })
      opened.push(copy)
      expect(copy.query<UserVersionRow, []>('PRAGMA user_version').get()?.user_version).toBe(7)
   })

   test('replaces an empty target and the WAL it left behind', () => {
      const from = fileNamed('replacing-source.db')
      const to = fileNamed('replaced-target.db')
      withSchema(from).exec('INSERT INTO portfolio (name) VALUES (\'Core\')')
      fs.writeFileSync(to, '')
      fs.writeFileSync(`${to}-wal`, 'stale')
      fs.writeFileSync(`${to}-shm`, 'stale')

      copyDatabase(from, to)

      expect(portfolioCount(to)).toBe(1)
      expect(fs.existsSync(`${to}.migrating`)).toBe(false)
   })

   test('leaves the source as it was', () => {
      const from = fileNamed('kept-source.db')
      const to = fileNamed('kept-target.db')
      const source = withSchema(from)
      source.exec('INSERT INTO portfolio (name) VALUES (\'Core\')')

      copyDatabase(from, to)
      source.exec('INSERT INTO portfolio (name) VALUES (\'Satellite\')')

      expect(portfolioCount(from)).toBe(2)
      expect(portfolioCount(to)).toBe(1)
   })
})
