import AnthropicAPI, {
   MODEL, CLASSIFY_CHUNK_SIZE, CLASSIFY_CONCURRENCY, DESCRIBE_CONCURRENCY, chunked
} from '../adapters/anthropic/adapter'
import XStockRepository from '../db/xstock-repository'
import { seededListing } from './xstock-reference'
import { messageOf } from '../errors'
import type { Credentials } from '../../types/credentials'
import type { StartedJob, XStockJob, XStockJobKind, XStockStep, XStockStepPhase } from '../../types/jobs'
import type { TokenizedListing } from '../../types/kraken'
import type {
   AiActivity, AiActivityReporter, XStockAiListing, XStockClassification, XStockTarget
} from '../../types/xstock'

// One unit of work: a group of tickers handed to Claude in a single call, reporting
// what it is doing as it goes.
type Worker = (tickers: string[], onActivity: AiActivityReporter) => Promise<void>

interface WorkerContext {
   job: XStockJob
   anthropicAPI: AnthropicAPI
   repository: XStockRepository
   signal: AbortSignal
}

interface JobRequest {
   kind: XStockJobKind
   wordCount: number | null
   groups: string[][]
   concurrency: number
   run: (context: WorkerContext) => Promise<Worker>
}

const terminalPhases: string[] = ['done', 'error', 'cancelled']

let job: XStockJob | null = null
let controller: AbortController | null = null

export function isRunning(candidate: XStockJob | null): candidate is XStockJob {
   return Boolean(candidate) && !terminalPhases.includes(candidate!.phase)
}

export function currentJob(): XStockJob | null {
   return job
}

export function requestCancel(): XStockJob | null {
   if (isRunning(job)) {
      job.cancelRequested = true
      job.updatedAt = Date.now()
      controller?.abort()
   }
   return job
}

export function startDescribe(
   { credentials, tickers, wordCount }: { credentials: Credentials, tickers: string[], wordCount: number }
): StartedJob<XStockJob | null> {
   return start({
      kind: 'describe',
      wordCount,
      groups: chunked(tickers, 1),
      concurrency: DESCRIBE_CONCURRENCY,
      run: (context) => describeWorker(context)
   }, credentials)
}

export function startClassify(
   { credentials, listings }: { credentials: Credentials, listings: TokenizedListing[] }
): StartedJob<XStockJob | null> {
   const altnames = new Map(listings.map(listing => [listing.ticker, listing.altname]))
   return start({
      kind: 'classify',
      wordCount: null,
      groups: chunked(listings.map(listing => listing.ticker), CLASSIFY_CHUNK_SIZE),
      concurrency: CLASSIFY_CONCURRENCY,
      run: (context) => classifyWorker(context, altnames)
   }, credentials)
}

function start(
   { kind, wordCount, groups, concurrency, run }: JobRequest, credentials: Credentials
): StartedJob<XStockJob | null> {

   if (isRunning(job)) return { job, alreadyRunning: true }

   job = {
      kind,
      wordCount,
      phase: 'running',
      startedAt: Date.now(),
      updatedAt: Date.now(),
      finishedAt: null,
      steps: groups.flatMap((group, index) => group.map(ticker => newStep(ticker, index))),
      error: null,
      cancelRequested: false
   }

   controller = new AbortController()

   const started = job
   const signal = controller.signal

   runJob(started, groups, concurrency, run, credentials, signal)
      .catch(error => console.error(`Unexpected xStocks ${kind} failure:`, error))

   return { job: started, alreadyRunning: false }
}

function newStep(ticker: string, group: number): XStockStep {
   return {
      ticker,
      group,
      phase: 'pending',
      activity: '',
      searches: [],
      startedAt: null,
      finishedAt: null,
      error: null
   }
}

async function runJob(
   job: XStockJob, groups: string[][], concurrency: number,
   run: JobRequest['run'], credentials: Credentials, signal: AbortSignal
) {

   try {
      const anthropicAPI = new AnthropicAPI(credentials.apiKey)
      const repository = new XStockRepository()
      const worker = await run({ job, anthropicAPI, repository, signal })

      await inParallel(groups.map((_, index) => index), concurrency,
         index => runGroup(job, index, worker))

      finish(job)
   }
   catch (error) {
      finishSteps(job, job.steps.filter(step => step.phase === 'pending'), 'skipped')
      job.phase = 'error'
      job.error = messageOf(error)
      job.finishedAt = Date.now()
      job.updatedAt = job.finishedAt
      console.error(`xStocks ${job.kind} failed before it could run:`, job.error)
   }
}

async function describeWorker({ job, anthropicAPI, repository, signal }: WorkerContext): Promise<Worker> {

   const tickers = job.steps.map(step => step.ticker)
   const stored = repository.findListings(tickers)

   const targets = new Map(tickers.map((ticker): [string, XStockTarget] => {
      const base = seededListing(ticker) ?? stored.get(ticker)
      return [ticker, {
         ticker,
         name: base?.name ?? '',
         exchange: base?.exchange ?? '',
         type: base?.type ?? 'unknown',
         subtype: base?.subtype ?? ''
      }] as const
   }))

   return async ([ticker], onActivity) => {

      const described = await anthropicAPI.describeListing(
         targets.get(ticker)!, job.wordCount!, { onActivity, abortSignal: signal })

      if (!described.description.trim()) throw new Error('Claude returned an empty description.')

      repository.upsertDescriptions([described], job.wordCount!, MODEL, Date.now())
   }
}

async function classifyWorker(
   { anthropicAPI, repository, signal }: WorkerContext, altnames: Map<string, string>
): Promise<Worker> {

   return async (tickers, onActivity) => {

      const returned = await anthropicAPI.classifyTickers(tickers, { onActivity, abortSignal: signal })
      repository.upsertListings(reconcile(tickers, returned, altnames), Date.now())
   }
}

async function runGroup(job: XStockJob, group: number, worker: Worker) {

   const steps = job.steps.filter(step => step.group === group)

   if (job.cancelRequested) return finishSteps(job, steps, 'cancelled')

   const startedAt = Date.now()
   for (const step of steps) {
      step.phase = 'running'
      step.startedAt = startedAt
   }

   setActivity(job, steps, 'Asking Claude…')

   try {
      await worker(steps.map(step => step.ticker), (event) => report(job, steps, event))
      finishSteps(job, steps, 'done')
   }
   catch (error) {
      const message = messageOf(error)
      if (job.cancelRequested) finishSteps(job, steps, 'cancelled')
      else finishSteps(job, steps, 'error', message)
   }
}

function report(job: XStockJob, steps: XStockStep[], event: AiActivity) {

   if (event.type === 'searching') {
      for (const step of steps) step.searches.push(event.query)
      return setActivity(job, steps,
         event.query ? `Searching the web for “${event.query}”` : 'Searching the web…')
   }

   if (event.type === 'reading') {
      const query = steps[0]?.searches.at(-1)
      return setActivity(job, steps,
         query ? `Reading the results for “${query}”` : 'Reading what the search found…')
   }

   setActivity(job, steps, 'Writing the answer…')
}

function setActivity(job: XStockJob, steps: XStockStep[], activity: string) {
   if (steps.every(step => step.activity === activity)) return
   for (const step of steps) step.activity = activity
   job.updatedAt = Date.now()
}

function finishSteps(job: XStockJob, steps: XStockStep[], phase: XStockStepPhase, error: string | null = null) {
   const finishedAt = Date.now()
   for (const step of steps) {
      step.phase = phase
      step.activity = ''
      step.error = error
      step.finishedAt = finishedAt
   }
   job.updatedAt = finishedAt
}

function finish(job: XStockJob) {

   const done = job.steps.filter(step => step.phase === 'done').length
   const failed = job.steps.filter(step => step.phase === 'error')

   if (job.cancelRequested) job.phase = 'cancelled'
   else if (done === 0 && failed.length > 0) {
      job.phase = 'error'
      job.error = failed[0].error
   }
   else job.phase = 'done'

   job.finishedAt = Date.now()
   job.updatedAt = job.finishedAt

   console.log(`xStocks ${job.kind} finished ${job.phase}: ${done} done, ${failed.length} failed`)
}

const inParallel = async <T>(items: T[], size: number, worker: (item: T) => Promise<void>) => {
   let cursor = 0
   const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
      while (cursor < items.length) await worker(items[cursor++])
   })
   await Promise.all(runners)
}

function reconcile(
   requested: string[], returned: XStockAiListing[], altnames: Map<string, string>
): XStockClassification[] {

   const wanted = new Set(requested)
   const seen = new Map<string, XStockAiListing>()

   for (const item of returned) {
      if (!wanted.has(item.ticker)) {
         console.warn(`xStocks classification returned an unrequested ticker, dropping: ${item.ticker}`)
         continue
      }
      seen.set(item.ticker, item)
   }

   return requested.map(ticker => {
      const item = seen.get(ticker)
      if (!item) console.warn(`xStocks classification omitted a requested ticker: ${ticker}`)

      const named = Boolean(item?.officialName?.trim())
      const type = !item || !named ? 'unknown' as const : item.type

      return {
         ticker,
         altname: altnames.get(ticker) ?? '',
         name: named ? item!.officialName.trim() : '',
         exchange: item?.listingExchange ?? '',
         type,
         subtype: type === 'unknown' ? '' : item?.subtype ?? '',
         confidence: type === 'unknown' ? 'low' : item?.confidence ?? 'low',
         sources: item?.sources ?? [],
         origin: 'ai'
      }
   })
}
