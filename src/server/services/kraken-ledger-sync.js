import KrakenAPI from '../adapters/kraken-api/adapter.js'
import LedgerRepository from '../db/ledger-repository.js'
import { accountIdFor } from '../db/entry-key.js'

// Kraken can post a staking or earn entry dated a day or two in the past, so an
// incremental sync re-reads a window behind the last entry it holds. Re-reading is
// free: entries are upserted by id.
const OVERLAP_MS = 72 * 60 * 60 * 1000

// Kraken's private endpoints share a decaying call counter. Polling every two
// seconds outruns the counter's refill on a Starter key and starts failing calls
// made by the rest of the app, so the interval widens as the wait goes on.
const pollDelays = [2000, 2000, 3000, 3000, 5000, 5000, 8000, 10000]
const MAX_WAIT_MS = 10 * 60 * 1000

// Reports left behind by an interrupted run count against Kraken's per-account
// limit, so each sync clears out its own stale ones first.
const REPORT_PREFIX = 'crypto-tools-'
const ORPHAN_AGE_MS = 15 * 60 * 1000

const CHUNK_SIZE = 5000

const terminalPhases = ['done', 'error', 'cancelled']

const jobs = new Map()

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

export function isRunning(job) {
   return Boolean(job) && !terminalPhases.includes(job.phase)
}

export function jobFor(accountId) {
   return jobs.get(accountId) ?? null
}

export function requestCancel(accountId) {
   const job = jobs.get(accountId)
   if (isRunning(job)) job.cancelRequested = true
   return job ?? null
}

export function startSync(credentials, mode = 'incremental') {

   const accountId = accountIdFor(credentials.apiKey)
   const existing = jobs.get(accountId)

   // A second request while a sync is running must not trigger another export:
   // that would cost a second report and a second slice of the rate limit.
   if (isRunning(existing)) {
      return { job: existing, alreadyRunning: true }
   }

   const job = {
      accountId,
      mode,
      phase: 'requesting',
      startedAt: Date.now(),
      updatedAt: Date.now(),
      finishedAt: null,
      reportId: null,
      reportStatus: null,
      pollCount: 0,
      requestedFrom: null,
      counts: { parsed: 0, stored: 0, inserted: 0, updated: 0, skipped: 0 },
      error: null,
      cancelRequested: false
   }

   jobs.set(accountId, job)

   // Deliberately not awaited: the caller answers immediately and the page follows
   // the run through the status endpoint.
   runSync(job, credentials).catch(error => {
      console.error('Unexpected ledger sync failure:', error)
   })

   return { job, alreadyRunning: false }
}

function setPhase(job, phase) {
   job.phase = phase
   job.updatedAt = Date.now()
}

async function runSync(job, credentials) {

   const krakenAPI = new KrakenAPI(credentials)
   const repository = new LedgerRepository(job.accountId)

   try {
      await removeOrphanedReports(krakenAPI)

      const fromDate = job.mode === 'full' ? 0 : incrementalStart(repository)
      job.requestedFrom = fromDate

      job.reportId = await krakenAPI.requestLedgerExport({
         description: `${REPORT_PREFIX}${new Date().toISOString()}`,
         fromDate
      })

      // Persisted before polling so that a restart mid-run can still clean up.
      repository.writeSyncState({
         apiKeyPrefix: credentials.apiKey.slice(0, 8),
         lastReportId: job.reportId
      })

      setPhase(job, 'waiting')
      await waitForReport(job, krakenAPI)

      setPhase(job, 'downloading')
      const { entries, skipped } = await krakenAPI.fetchLedgerEntries(job.reportId)

      setPhase(job, 'parsing')
      job.counts.parsed = entries.length
      job.counts.skipped = skipped

      setPhase(job, 'storing')
      await storeEntries(job, repository, entries)

      setPhase(job, 'cleaning')
      finishSyncState(repository, entries)
      setPhase(job, 'done')
   }
   catch (error) {
      if (job.phase !== 'cancelled') {
         setPhase(job, 'error')
         job.error = String(error.cause ?? error.message ?? error)
         console.error('Ledger sync failed:', job.error)
         repository.writeSyncState({ lastError: job.error })
      }
   }
   finally {
      job.finishedAt = Date.now()
      job.updatedAt = Date.now()
      if (job.reportId) await safeRemoveReport(krakenAPI, job.reportId)
   }
}

function incrementalStart(repository) {

   const state = repository.readSyncState()
   const { last } = repository.entryTimeRange()

   const watermark = [state?.coveredTo, last].filter(Boolean)
   if (watermark.length === 0) return 0

   return Math.max(0, Math.min(...watermark) - OVERLAP_MS)
}

async function waitForReport(job, krakenAPI) {

   const deadline = Date.now() + MAX_WAIT_MS

   while (Date.now() < deadline) {

      await delay(pollDelays[Math.min(job.pollCount, pollDelays.length - 1)])

      if (job.cancelRequested) {
         setPhase(job, 'cancelled')
         throw new Error('Sync cancelled.')
      }

      job.pollCount++
      job.updatedAt = Date.now()

      // One call covers every ledger report, so there is no need to poll per id.
      const reports = await krakenAPI.fetchExportReports()
      const report = reports.find(candidate => candidate.id === job.reportId)

      if (report) {
         job.reportStatus = report.status
         if (report.status?.toLowerCase() === 'processed') return
      }
   }

   throw new Error('Kraken did not finish preparing the export within 10 minutes.')
}

async function storeEntries(job, repository, entries) {

   const before = repository.countEntries()

   // bun:sqlite is synchronous, so a single transaction over the whole export would
   // block the status endpoint for its entire duration. Committing in chunks keeps
   // the server answering and lets progress be reported.
   for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
      repository.upsertEntries(entries.slice(i, i + CHUNK_SIZE), Date.now())
      job.counts.stored = Math.min(i + CHUNK_SIZE, entries.length)
      job.updatedAt = Date.now()
      await delay(0)
   }

   const after = repository.countEntries()
   job.counts.inserted = after - before
   job.counts.updated = job.counts.stored - job.counts.inserted
}

function finishSyncState(repository, entries) {

   const { first, last } = repository.entryTimeRange()
   const state = repository.readSyncState()
   const now = Date.now()

   // The watermark comes from the data Kraken returned rather than from the local
   // clock, so clock drift can never move it past what was actually fetched.
   repository.writeSyncState({
      coveredFrom: first,
      coveredTo: last ?? state?.coveredTo ?? null,
      firstSyncedAt: state?.firstSyncedAt ?? now,
      lastSyncedAt: now,
      lastReportId: null,
      lastError: null
   })

   console.log(`Ledger sync stored ${entries.length} entries`)
}

async function removeOrphanedReports(krakenAPI) {
   try {
      const cutoff = Date.now() - ORPHAN_AGE_MS
      const reports = await krakenAPI.fetchExportReports()

      for (const report of reports) {
         if (report.description?.startsWith(REPORT_PREFIX) && report.createdDate < cutoff) {
            console.log('Removing orphaned Kraken export:', report.id)
            await safeRemoveReport(krakenAPI, report.id)
         }
      }
   }
   catch (error) {
      // Cleanup is opportunistic; a failure here must not stop the sync.
      console.warn('Could not check for orphaned exports:', error.message)
   }
}

async function safeRemoveReport(krakenAPI, reportId) {
   try {
      await krakenAPI.removeExport(reportId)
   }
   catch (error) {
      // Never let a failed cleanup mask the error that actually ended the run.
      console.warn('Could not remove Kraken export', reportId, error.message)
   }
}
