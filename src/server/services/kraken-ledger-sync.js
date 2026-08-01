import KrakenAPI from '../adapters/kraken-api/adapter.js'
import LedgerRepository from '../db/ledger-repository.js'
import TradeRepository from '../db/trade-repository.js'
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

// One run covers both reports. The ledger has the full picture of what moved; the
// trades report is the only place Kraken puts the order id, so the Closed Orders
// page cannot be built without it.
const reports = ['ledgers', 'trades']

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
      report: reports[0],
      startedAt: Date.now(),
      updatedAt: Date.now(),
      finishedAt: null,
      // reportId is the one in flight, kept alongside the map so the status card can
      // show what Kraken is currently preparing without knowing about either report.
      reportId: null,
      reportIds: { ledgers: null, trades: null },
      reportStatus: null,
      pollCount: 0,
      requestedFrom: null,
      counts: { parsed: 0, stored: 0, inserted: 0, updated: 0, skipped: 0 },
      results: {},
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
   const tradeRepository = new TradeRepository(job.accountId)

   try {
      await removeOrphanedReports(krakenAPI)

      repository.writeSyncState({ apiKeyPrefix: credentials.apiKey.slice(0, 8) })

      await runReport(job, krakenAPI, repository, {
         report: 'ledgers',
         fromDate: startFor(job, repository, tradeRepository, 'ledgers'),
         read: async (reportId) => {
            const { entries, skipped } = await krakenAPI.fetchLedgerEntries(reportId)
            return { rows: entries, skipped }
         },
         count: () => repository.countEntries(),
         upsert: (chunk, syncedAt) => repository.upsertEntries(chunk, syncedAt)
      })

      // Committed before the second report runs. That phase roughly doubles the
      // window in which the run can die, and folding both watermarks into one write
      // at the end would throw away this one's progress along with it.
      finishLedgerState(repository)

      throwIfCancelled(job)

      // Only the trades report needs the pair index, so it is fetched here rather
      // than paid for on a run that might already have failed above.
      const pairIndex = await krakenAPI.fetchPairIndex()

      await runReport(job, krakenAPI, repository, {
         report: 'trades',
         fromDate: startFor(job, repository, tradeRepository, 'trades'),
         read: async (reportId) => {
            const { trades, skipped } = await krakenAPI.fetchTradeEntries(reportId, pairIndex)
            return { rows: trades, skipped }
         },
         count: () => tradeRepository.countTrades(),
         upsert: (chunk, syncedAt) => tradeRepository.upsertTrades(chunk, syncedAt)
      })

      finishTradeState(repository, tradeRepository, job.startedAt)

      setPhase(job, 'cleaning')
      finishSyncState(repository)
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

      // Both reports have to go, not just the one in flight when the run ended.
      for (const reportId of Object.values(job.reportIds)) {
         if (reportId) await safeRemoveReport(krakenAPI, reportId)
      }
   }
}

// Requests one export, waits for Kraken to prepare it, then reads and stores it. The
// phase names are the same for either report so that the page can render progress
// without knowing which one is running; `job.report` says which it is.
async function runReport(job, krakenAPI, repository, { report, fromDate, read, count, upsert }) {

   job.report = report
   job.pollCount = 0
   job.reportStatus = null
   job.requestedFrom = fromDate
   job.counts = { parsed: 0, stored: 0, inserted: 0, updated: 0, skipped: 0 }

   setPhase(job, 'requesting')
   const reportId = await krakenAPI.requestExport({
      report,
      description: `${REPORT_PREFIX}${new Date().toISOString()}`,
      fromDate
   })

   job.reportIds[report] = reportId
   job.reportId = reportId

   // Persisted before polling so that a restart mid-run can still clean up.
   repository.writeSyncState({ lastReportId: reportId })

   setPhase(job, 'waiting')
   await waitForReport(job, krakenAPI, report)

   setPhase(job, 'downloading')
   const { rows, skipped } = await read(reportId)

   setPhase(job, 'parsing')
   job.counts.parsed = rows.length
   job.counts.skipped = skipped

   setPhase(job, 'storing')
   await storeRows(job, rows, count, upsert)

   job.results[report] = { ...job.counts }
   console.log(`Kraken ${report} sync stored ${rows.length} rows`)
}

function throwIfCancelled(job) {
   if (!job.cancelRequested) return
   setPhase(job, 'cancelled')
   throw new Error('Sync cancelled.')
}

function startFor(job, repository, tradeRepository, report) {
   return job.mode === 'full' ? 0 : incrementalStart(repository, tradeRepository, report)
}

function incrementalStart(repository, tradeRepository, report) {

   const state = repository.readSyncState()

   // Each report keeps its own watermark. Sharing one would be worse than untidy:
   // an account synced before trades were stored already has the ledger watermark at
   // "now", so a shared value would ask for trades starting today and no historical
   // trade would ever be backfilled.
   const [coveredTo, range] = report === 'trades'
      ? [state?.tradesCoveredTo, tradeRepository.tradeTimeRange()]
      : [state?.coveredTo, repository.entryTimeRange()]

   const watermark = [coveredTo, range.last].filter(Boolean)
   if (watermark.length === 0) return 0

   return Math.max(0, Math.min(...watermark) - OVERLAP_MS)
}

async function waitForReport(job, krakenAPI, report) {

   const deadline = Date.now() + MAX_WAIT_MS

   while (Date.now() < deadline) {

      await delay(pollDelays[Math.min(job.pollCount, pollDelays.length - 1)])

      throwIfCancelled(job)

      job.pollCount++
      job.updatedAt = Date.now()

      // One call covers every report of this type, so there is no need to poll per
      // id — but it must be this type: Kraken lists one type per call, and asking
      // for the wrong one would simply never find the report.
      const entries = await krakenAPI.fetchExportReports(report)
      const entry = entries.find(candidate => candidate.id === job.reportId)

      if (entry) {
         job.reportStatus = entry.status
         if (entry.status?.toLowerCase() === 'processed') return
      }
   }

   throw new Error(`Kraken did not finish preparing the ${report} export within 10 minutes.`)
}

async function storeRows(job, rows, count, upsert) {

   const before = count()

   // bun:sqlite is synchronous, so a single transaction over the whole export would
   // block the status endpoint for its entire duration. Committing in chunks keeps
   // the server answering and lets progress be reported.
   for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      upsert(rows.slice(i, i + CHUNK_SIZE), Date.now())
      job.counts.stored = Math.min(i + CHUNK_SIZE, rows.length)
      job.updatedAt = Date.now()
      await delay(0)
   }

   const after = count()
   job.counts.inserted = after - before
   job.counts.updated = job.counts.stored - job.counts.inserted
}

// The watermarks come from the data Kraken returned rather than from the local
// clock, so clock drift can never move one past what was actually fetched.
function finishLedgerState(repository) {

   const { first, last } = repository.entryTimeRange()
   const state = repository.readSyncState()

   repository.writeSyncState({
      coveredFrom: first,
      coveredTo: last ?? state?.coveredTo ?? null
   })
}

function finishTradeState(repository, tradeRepository, startedAt) {

   const { first, last } = tradeRepository.tradeTimeRange()
   const state = repository.readSyncState()

   // An account that has never traded has no last trade to derive a watermark from.
   // Falling back to when this run started records that everything up to here was
   // read and found empty, rather than re-requesting the whole history every sync.
   repository.writeSyncState({
      tradesCoveredFrom: first,
      tradesCoveredTo: last ?? state?.tradesCoveredTo ?? startedAt
   })
}

function finishSyncState(repository) {

   const state = repository.readSyncState()
   const now = Date.now()

   repository.writeSyncState({
      firstSyncedAt: state?.firstSyncedAt ?? now,
      lastSyncedAt: now,
      lastReportId: null,
      lastError: null
   })
}

async function removeOrphanedReports(krakenAPI) {
   try {
      const cutoff = Date.now() - ORPHAN_AGE_MS

      // Both types, or stale trades reports pile up against Kraken's per-account
      // limit until AddExport starts refusing new ones.
      for (const report of reports) {
         const entries = await krakenAPI.fetchExportReports(report)

         for (const entry of entries) {
            if (entry.description?.startsWith(REPORT_PREFIX) && entry.createdDate < cutoff) {
               console.log('Removing orphaned Kraken export:', entry.id)
               await safeRemoveReport(krakenAPI, entry.id)
            }
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
