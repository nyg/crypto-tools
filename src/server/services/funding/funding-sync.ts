import FundingRepository, { fundingAccountOf, rememberFundingAccount } from '../../db/funding-repository'
import { accountIdFor } from '../../db/entry-key'
import { HttpRequesterError, messageOf } from '../../errors'
import type { FundingFeed, FundingVenue } from './venues'
import type { FundingCancelResponse, FundingResponse, FundingSyncResponse } from '../../../types/api'
import type { Credentials } from '../../../types/credentials'
import type { FundingVenueId, FundingWindow } from '../../../types/funding'
import type { FundingJob, FundingStep } from '../../../types/jobs'

const DAY = 86400000

// A movement can settle days after it first shows up, so every sync reads this far
// behind what it already covered. Rows are upserted by id, so reading twice is free.
const OVERLAP_MS = 7 * DAY

// One still pending pulls the start back to itself, but not for ever: a row the
// exchange stopped serving would otherwise drag every later sync back to its date.
const PENDING_HORIZON_MS = 90 * DAY

const jobs = new Map<string, FundingJob>()

const jobKey = (venue: FundingVenueId, credentials: Credentials) => `${venue}:${accountIdFor(credentials.apiKey)}`

const isRunning = (job: FundingJob | undefined): job is FundingJob => job?.phase === 'running'

export function fundingWindows(from: number, now: number, windowMs: number): FundingWindow[] {

   const windows: FundingWindow[] = []

   for (let start = from; start <= now; start += windowMs) {
      windows.push({ from: start, to: Math.min(start + windowMs - 1, now) })
   }

   return windows
}

export function syncStart(
   { coveredTo, pending }: { coveredTo: number | null, pending: number | null }, epoch: number
): number {
   if (coveredTo === null) return epoch
   return Math.max(epoch, Math.min(coveredTo + 1 - OVERLAP_MS, pending ?? Infinity))
}

export function fundingOverview(venue: FundingVenue, credentials: Credentials): FundingResponse {

   const account = fundingAccountOf(venue.id, accountIdFor(credentials.apiKey))

   return {
      movements: account ? new FundingRepository(venue.id, account.accountId).movements() : [],
      lastSyncedAt: account?.lastSyncedAt ?? null,
      job: jobs.get(jobKey(venue.id, credentials)) ?? null
   }
}

export function cancelFundingSync(venue: FundingVenue, credentials: Credentials): FundingCancelResponse {
   const job = jobs.get(jobKey(venue.id, credentials))
   if (isRunning(job)) job.cancelRequested = true
   return { job: job ?? null }
}

export function startFundingSync(venue: FundingVenue, credentials: Credentials): FundingSyncResponse {

   const key = jobKey(venue.id, credentials)
   const existing = jobs.get(key)
   if (isRunning(existing)) return { job: existing, alreadyRunning: true }

   const feeds = venue.feeds(credentials)
   const job = newFundingJob(feeds)

   jobs.set(key, job)

   runFundingSync(job, venue, credentials, feeds).catch(error => {
      console.error('Unexpected funding sync failure:', error)
   })

   return { job, alreadyRunning: false }
}

export function newFundingJob(feeds: FundingFeed[], now = Date.now()): FundingJob {
   return {
      phase: 'running',
      startedAt: now,
      updatedAt: now,
      finishedAt: null,
      steps: feeds.map(({ id, label }) => ({ feed: id, label, phase: 'pending', windows: 0, windowsDone: 0, stored: 0 })),
      error: null,
      cancelRequested: false
   }
}

export async function runFundingSync(
   job: FundingJob, venue: FundingVenue, credentials: Credentials, feeds: FundingFeed[], now = Date.now()
): Promise<void> {

   const exchange = venue.exchange(credentials)

   try {
      const { accountId } = await exchange.account()
      rememberFundingAccount(venue.id, accountIdFor(credentials.apiKey), accountId)

      const repository = new FundingRepository(venue.id, accountId)

      for (const [index, feed] of feeds.entries()) {
         await runFeed(job, job.steps[index]!, feed, repository, venue.epoch, now)
      }

      repository.markSynced(Date.now())
      job.phase = 'done'
   }
   catch (error) {
      const step = job.steps.find(({ phase }) => phase === 'running')

      if (job.cancelRequested) {
         job.phase = 'cancelled'
         if (step) step.phase = 'cancelled'
      }
      else {
         job.phase = 'error'
         job.error = error instanceof HttpRequesterError ? exchange.describeError(error) : messageOf(error)
         if (step) step.phase = 'error'
         console.error(`Funding sync failed for ${venue.id}:`, job.error)
      }

      for (const pending of job.steps) {
         if (pending.phase === 'pending') pending.phase = 'skipped'
      }
   }
   finally {
      job.finishedAt = Date.now()
      job.updatedAt = Date.now()
   }
}

// The watermark moves after every window, so a run that fails or is cancelled part
// way keeps what it stored and the next one carries on from there.
async function runFeed(
   job: FundingJob, step: FundingStep, feed: FundingFeed, repository: FundingRepository, epoch: number, now: number
): Promise<void> {

   const from = syncStart({
      coveredTo: repository.coveredTo(feed.id),
      pending: repository.earliestPending(feed.id, now - PENDING_HORIZON_MS)
   }, epoch)

   const windows = fundingWindows(from, now, feed.windowMs)

   step.phase = 'running'
   step.windows = windows.length
   job.updatedAt = Date.now()

   for (const window of windows) {
      if (job.cancelRequested) throw new Error('Sync cancelled.')

      const records = await feed.fetch(window)
      repository.upsert(feed.id, records, Date.now())
      repository.setCoveredTo(feed.id, window.to)

      step.windowsDone++
      step.stored += records.length
      job.updatedAt = Date.now()
   }

   step.phase = 'done'
}
