import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { HttpRequesterError } from '../../errors'
import type * as FundingSync from './funding-sync'
import type { FundingFeed, FundingVenue } from './venues'
import type { Credentials } from '../../../types/credentials'
import type { FundingRecord, FundingWindow } from '../../../types/funding'
import type { FundingJob } from '../../../types/jobs'

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crypto-tools-funding-'))

const DAY = 86400000
const EPOCH = Date.UTC(2026, 0, 1)
const NOW = EPOCH + 75 * DAY

let sync: typeof FundingSync

const record = (id: string, time: number, changes: Partial<FundingRecord> = {}): FundingRecord => ({
   id, kind: 'deposit', asset: 'USDT', amount: '100', fee: '0', method: 'TRX', status: 'completed', time, ...changes
})

const credentialsOf = (apiKey: string): Credentials => ({ apiKey, apiSecret: 'secret' })

const venueFor = (accountId: string): FundingVenue => ({
   id: 'bybit',
   provider: 'bybit',
   epoch: EPOCH,
   exchange: () => ({
      account: async () => ({ accountId, canTrade: false, expiresAt: null }),
      describeError: error => `described: ${String(error.cause)}`
   }),
   feeds: () => []
})

function feedOf(records: FundingRecord[], id = 'deposit') {

   const asked: FundingWindow[] = []

   const feed: FundingFeed = {
      id,
      label: id,
      windowMs: 30 * DAY,
      fetch: async window => {
         asked.push(window)
         return records.filter(({ time }) => time >= window.from && time <= window.to)
      }
   }

   return { feed, asked }
}

async function run(venue: FundingVenue, credentials: Credentials, feeds: FundingFeed[], now = NOW) {
   const job = sync.newFundingJob(feeds, now)
   await sync.runFundingSync(job, venue, credentials, feeds, now)
   return job
}

async function finished(job: FundingJob) {
   while (job.phase === 'running') await new Promise(resolve => setTimeout(resolve, 5))
}

beforeAll(async () => {
   process.env.CRYPTO_TOOLS_DATA_DIR = dataDir
   sync = await import('./funding-sync')
})

afterAll(async () => {
   const { closeDatabase } = await import('../../db/database')
   closeDatabase()
   fs.rmSync(dataDir, { recursive: true, force: true })
})

describe('fundingWindows', () => {

   test('walks from the start to now in windows that never overlap, the last one cut at now', () => {
      expect(sync.fundingWindows(EPOCH, NOW, 30 * DAY)).toEqual([
         { from: EPOCH, to: EPOCH + 30 * DAY - 1 },
         { from: EPOCH + 30 * DAY, to: EPOCH + 60 * DAY - 1 },
         { from: EPOCH + 60 * DAY, to: NOW }
      ])
   })

   test('asks a feed with no window limit for everything at once', () => {
      expect(sync.fundingWindows(EPOCH, NOW, Infinity)).toEqual([{ from: EPOCH, to: NOW }])
   })
})

describe('syncStart', () => {

   test('starts a feed never read at the epoch', () => {
      expect(sync.syncStart({ coveredTo: null, pending: null }, EPOCH)).toBe(EPOCH)
   })

   test('reads a week behind what is covered, and from a pending movement if that is earlier', () => {
      const coveredTo = EPOCH + 60 * DAY
      expect(sync.syncStart({ coveredTo, pending: null }, EPOCH)).toBe(coveredTo + 1 - 7 * DAY)
      expect(sync.syncStart({ coveredTo, pending: EPOCH + 40 * DAY }, EPOCH)).toBe(EPOCH + 40 * DAY)
      expect(sync.syncStart({ coveredTo, pending: coveredTo }, EPOCH)).toBe(coveredTo + 1 - 7 * DAY)
   })

   test('never starts before the epoch', () => {
      expect(sync.syncStart({ coveredTo: EPOCH + DAY, pending: null }, EPOCH)).toBe(EPOCH)
   })
})

describe('runFundingSync', () => {

   test('stores every window of a first sync and lists what did not fail', async () => {

      const venue = venueFor('first')
      const credentials = credentialsOf('first-key')
      const { feed, asked } = feedOf([
         record('a', EPOCH + DAY),
         record('b', EPOCH + 40 * DAY, { status: 'pending' }),
         record('c', EPOCH + 70 * DAY, { status: 'failed' })
      ])

      const job = await run(venue, credentials, [feed])
      const overview = sync.fundingOverview(venue, credentials)

      expect(job.phase).toBe('done')
      expect(job.steps[0]).toMatchObject({ phase: 'done', windows: 3, windowsDone: 3, stored: 3 })
      expect(asked).toHaveLength(3)
      expect(overview.lastSyncedAt).not.toBeNull()
      expect(overview.movements.map(({ id, pending }) => ({ id, pending }))).toEqual([
         { id: 'deposit:a', pending: false },
         { id: 'deposit:b', pending: true }
      ])
   })

   test('reads back to a pending movement on the next sync, and takes its new state', async () => {

      const venue = venueFor('second')
      const credentials = credentialsOf('second-key')
      const pendingAt = NOW - 20 * DAY
      const records = [record('a', EPOCH + DAY), record('b', pendingAt, { status: 'pending' })]

      await run(venue, credentials, [feedOf(records).feed])

      const later = NOW + DAY
      const settled = feedOf([records[0]!, record('b', pendingAt, { amount: '250' })])
      await run(venue, credentials, [settled.feed], later)

      expect(settled.asked).toEqual([{ from: pendingAt, to: later }])
      expect(sync.fundingOverview(venue, credentials).movements.map(({ id, amount, pending }) => ({ id, amount, pending })))
         .toEqual([{ id: 'deposit:a', amount: '100', pending: false }, { id: 'deposit:b', amount: '250', pending: false }])
   })

   test('keeps what it stored when a window fails, and carries on from there the next time', async () => {

      const venue = venueFor('failing')
      const credentials = credentialsOf('failing-key')
      const { feed, asked } = feedOf([record('a', EPOCH + DAY)])
      const withdrawals = feedOf([], 'withdrawal')
      let calls = 0

      const failing: FundingFeed = {
         ...feed,
         fetch: async window => {
            if (++calls === 2) throw new HttpRequesterError(200, { retCode: 10006, retMsg: 'Too many visits.' })
            return feed.fetch(window)
         }
      }

      const job = await run(venue, credentials, [failing, withdrawals.feed])

      expect(job.phase).toBe('error')
      expect(job.error).toContain('described:')
      expect(job.steps.map(({ phase }) => phase)).toEqual(['error', 'skipped'])
      expect(sync.fundingOverview(venue, credentials)).toMatchObject({ lastSyncedAt: null, movements: [{ id: 'deposit:a' }] })

      asked.length = 0
      const resumed = await run(venue, credentials, [feed, withdrawals.feed])

      expect(resumed.phase).toBe('done')
      expect(asked[0]?.from).toBe(EPOCH + 23 * DAY)
      expect(withdrawals.asked).toHaveLength(3)
   })

   test('stops between two windows once cancelled', async () => {

      const venue = venueFor('cancelled')
      const credentials = credentialsOf('cancelled-key')
      const { feed, asked } = feedOf([])
      const job = sync.newFundingJob([feed, feedOf([], 'withdrawal').feed], NOW)

      const cancelling: FundingFeed = {
         ...feed,
         fetch: async window => {
            job.cancelRequested = true
            return feed.fetch(window)
         }
      }

      await sync.runFundingSync(job, venue, credentials, [cancelling, feedOf([], 'withdrawal').feed], NOW)

      expect(asked).toHaveLength(1)
      expect(job.phase).toBe('cancelled')
      expect(job.steps.map(({ phase }) => phase)).toEqual(['cancelled', 'skipped'])
      expect(job.finishedAt).not.toBeNull()
   })

   test('finds the same rows again under a new key of the same account', async () => {

      const venue = venueFor('rotated')
      const { feed } = feedOf([record('a', EPOCH + DAY)])

      await run(venue, credentialsOf('old-key'), [feed])

      expect(sync.fundingOverview(venue, credentialsOf('new-key')).movements).toEqual([])

      await run(venue, credentialsOf('new-key'), [feedOf([]).feed], NOW + DAY)

      expect(sync.fundingOverview(venue, credentialsOf('new-key')).movements).toHaveLength(1)
   })
})

describe('startFundingSync', () => {

   test('does not start a second run while one is in flight, and cancels the one that is', async () => {

      const credentials = credentialsOf('busy-key')
      const { feed, asked } = feedOf([])
      const venue: FundingVenue = { ...venueFor('busy'), feeds: () => [feed] }

      const first = sync.startFundingSync(venue, credentials)
      const second = sync.startFundingSync(venue, credentials)

      expect(first.alreadyRunning).toBe(false)
      expect(second).toEqual({ job: first.job, alreadyRunning: true })
      expect(sync.cancelFundingSync(venue, credentials).job?.cancelRequested).toBe(true)

      await finished(first.job)

      expect(sync.fundingOverview(venue, credentials).job?.phase).toBe('cancelled')
      expect(asked).toEqual([])

      const third = sync.startFundingSync(venue, credentials)
      await finished(third.job)

      expect(third.alreadyRunning).toBe(false)
      expect(third.job.phase).toBe('done')
   })
})
