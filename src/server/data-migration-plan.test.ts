import { describe, expect, test } from 'bun:test'
import { isComplete, planDataMigration, productionInUse } from './data-migration-plan'
import type { MigrationProgress, ProfileState } from './data-migration-plan'

const KRAKEN_KEYS = ['kraken-api-key', 'kraken-api-secret']

const profile = (changes: Partial<ProfileState> = {}): ProfileState =>
   ({ database: 'missing', settings: 'missing', stored: [], ...changes })

const progress = (changes: Partial<MigrationProgress> = {}): MigrationProgress =>
   ({ database: false, settings: false, credentials: false, copied: [], ...changes })

const upgraded = profile({ database: 'data', settings: 'data', stored: KRAKEN_KEYS })

describe('a first released start', () => {

   test('takes everything an upgraded install left under the development names', () => {
      expect(planDataMigration(null, profile(), upgraded))
         .toEqual({ database: true, settings: true, credentials: KRAKEN_KEYS })
   })

   test('takes nothing on a fresh install', () => {
      expect(planDataMigration(null, profile(), profile()))
         .toEqual({ database: false, settings: false, credentials: [] })
   })

   test('replaces a production database and settings that hold nothing', () => {
      const leftover = profile({ database: 'empty', settings: 'blank' })

      expect(planDataMigration(null, leftover, upgraded))
         .toEqual({ database: true, settings: true, credentials: KRAKEN_KEYS })
   })

   test('leaves a development database with no account data behind', () => {
      const development = profile({ database: 'empty', settings: 'blank' })

      expect(planDataMigration(null, profile(), development))
         .toEqual({ database: false, settings: false, credentials: [] })
   })

   test.each<[string, Partial<ProfileState>]>([
      ['account rows', { database: 'data' }],
      ['an account id or a key in its settings', { settings: 'data' }],
      ['a stored credential', { stored: ['binance-api-key'] }]
   ])('takes nothing when production already holds %s', (_, held) => {
      const production = profile(held)

      expect(productionInUse(production)).toBe(true)
      expect(planDataMigration(null, production, upgraded))
         .toEqual({ database: false, settings: false, credentials: [] })
   })

   test('does not count an empty database or blank settings as in use', () => {
      expect(productionInUse(profile({ database: 'empty', settings: 'blank' }))).toBe(false)
   })
})

describe('a start that resumes a migration', () => {

   test('copies only the steps that are not recorded', () => {
      const recorded = progress({ database: true })
      const production = profile({ database: 'data' })

      expect(planDataMigration(recorded, production, upgraded))
         .toEqual({ database: false, settings: true, credentials: KRAKEN_KEYS })
   })

   test('keeps a production database that was filled since', () => {
      const production = profile({ database: 'data' })

      expect(planDataMigration(progress(), production, upgraded).database).toBe(false)
   })

   test('keeps production settings that were written since', () => {
      const production = profile({ settings: 'data' })

      expect(planDataMigration(progress(), production, upgraded).settings).toBe(false)
   })

   test('copies only the credentials production does not hold', () => {
      const production = profile({ stored: ['kraken-api-key'] })

      expect(planDataMigration(progress(), production, upgraded).credentials)
         .toEqual(['kraken-api-secret'])
   })

   test('does not bring back a credential that was copied and removed since', () => {
      const recorded = progress({ copied: ['kraken-api-key'] })

      expect(planDataMigration(recorded, profile(), upgraded).credentials)
         .toEqual(['kraken-api-secret'])
   })

   test('copies no credential once that step is recorded', () => {
      const recorded = progress({ credentials: true })

      expect(planDataMigration(recorded, profile(), upgraded).credentials).toEqual([])
   })
})

describe('a migration', () => {

   test('is complete once every step is recorded', () => {
      expect(isComplete(progress({ database: true, settings: true, credentials: true }))).toBe(true)
   })

   test.each<[string, Partial<MigrationProgress>]>([
      ['database', { settings: true, credentials: true }],
      ['settings', { database: true, credentials: true }],
      ['credentials', { database: true, settings: true }]
   ])('is not complete while the %s step is missing', (_, recorded) => {
      expect(isComplete(progress(recorded))).toBe(false)
   })
})
