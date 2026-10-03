import type { FundingCancelResponse, FundingMovement, FundingResponse, FundingSyncResponse } from '../../types/api'
import type { FundingKind, FundingVenueId } from '../../types/funding'
import type { FundingJob, FundingStep } from '../../types/jobs'

interface Plan {
   asset: string
   kind: FundingKind
   method: string
   everyDays: number
   amount: number
   fee: number
   decimals: number
}

interface MockVenue {
   feeds: { label: string, windows: number }[]
   movements: FundingMovement[]
   lastSyncedAt: number | null
   run: { startedAt: number, cancelledAt: number | null } | null
}

const DAY = 86400000
const HOUR = 3600000
const HISTORY_DAYS = 900
const WINDOW_MS = 250

// Deterministic, so the fixture is the same across reloads. Two plans for the same
// asset and kind share their days, which is what puts several movements on one bar.
function movementsOf(prefix: string, plans: Plan[]): FundingMovement[] {

   const start = Date.now() - HISTORY_DAYS * DAY

   return plans
      .flatMap((plan, planIndex) => Array.from({ length: Math.floor(HISTORY_DAYS / plan.everyDays) }, (_, index) => ({
         id: `${prefix}-${planIndex}-${index}`,
         kind: plan.kind,
         asset: plan.asset,
         amount: String(Number((plan.amount * (1 + ((index * 7 + planIndex * 3) % 5) / 10)).toFixed(plan.decimals))),
         fee: String(plan.fee),
         method: plan.method,
         time: start + index * plan.everyDays * DAY + ((index * 5 + planIndex * 3) % 12) * HOUR,
         pending: false
      })))
      .toSorted((a, b) => a.time - b.time)
}

const withPending = (movements: FundingMovement[]): FundingMovement[] => [
   ...movements,
   {
      id: 'pending-withdrawal', kind: 'withdrawal', asset: 'USDT', amount: '750', fee: '1',
      method: 'TRX', time: Date.now() - 20 * 60000, pending: true
   }
]

const venues: Record<FundingVenueId, MockVenue> = {
   binance: {
      feeds: [
         { label: 'Crypto deposits', windows: 12 },
         { label: 'Crypto withdrawals', windows: 12 },
         { label: 'Fiat deposits', windows: 1 },
         { label: 'Fiat withdrawals', windows: 1 }
      ],
      movements: withPending(movementsOf('binance', [
         { asset: 'EUR', kind: 'deposit', method: 'BankAccount', everyDays: 30, amount: 1000, fee: 1, decimals: 2 },
         { asset: 'EUR', kind: 'deposit', method: 'Card', everyDays: 90, amount: 250, fee: 4.5, decimals: 2 },
         { asset: 'EUR', kind: 'withdrawal', method: 'BankAccount', everyDays: 210, amount: 2400, fee: 1, decimals: 2 },
         { asset: 'USDT', kind: 'deposit', method: 'TRX', everyDays: 75, amount: 1500, fee: 0, decimals: 2 },
         { asset: 'USDT', kind: 'withdrawal', method: 'BSC', everyDays: 110, amount: 900, fee: 0.3, decimals: 2 },
         { asset: 'BTC', kind: 'withdrawal', method: 'BTC', everyDays: 60, amount: 0.035, fee: 0.00015, decimals: 8 },
         { asset: 'BTC', kind: 'deposit', method: 'Internal', everyDays: 400, amount: 0.12, fee: 0, decimals: 8 },
         { asset: 'ETH', kind: 'withdrawal', method: 'ETH', everyDays: 130, amount: 0.8, fee: 0.0012, decimals: 8 }
      ])),
      lastSyncedAt: Date.now() - HOUR,
      run: null
   },
   bybit: {
      feeds: [
         { label: 'Deposits', windows: 30 },
         { label: 'Internal deposits', windows: 30 },
         { label: 'Withdrawals', windows: 30 }
      ],
      movements: movementsOf('bybit', [
         { asset: 'USDT', kind: 'deposit', method: 'TRX', everyDays: 45, amount: 2000, fee: 0, decimals: 2 },
         { asset: 'USDT', kind: 'deposit', method: 'Internal', everyDays: 180, amount: 500, fee: 0, decimals: 2 },
         { asset: 'USDT', kind: 'withdrawal', method: 'ARBI', everyDays: 120, amount: 1800, fee: 1, decimals: 2 },
         { asset: 'SOL', kind: 'withdrawal', method: 'SOL', everyDays: 150, amount: 14, fee: 0.008, decimals: 4 },
         { asset: 'ETH', kind: 'deposit', method: 'ETH', everyDays: 300, amount: 1.5, fee: 0, decimals: 8 }
      ]),
      lastSyncedAt: null,
      run: null
   }
}

// The run is derived from elapsed time on every read, so mocked mode drives the real
// polling loop instead of jumping straight to done.
function jobOf(venue: MockVenue): FundingJob | null {

   if (!venue.run) return null

   const { startedAt, cancelledAt } = venue.run
   const elapsed = (cancelledAt ?? Date.now()) - startedAt
   let offset = 0

   const steps = venue.feeds.map(({ label, windows }, index): FundingStep => {
      const done = Math.max(0, Math.min(windows, Math.floor((elapsed - offset) / WINDOW_MS)))
      const started = elapsed >= offset
      offset += windows * WINDOW_MS
      return {
         feed: String(index),
         label,
         phase: done === windows ? 'done' : !started ? (cancelledAt ? 'skipped' : 'pending') : cancelledAt ? 'cancelled' : 'running',
         windows: started ? windows : 0,
         windowsDone: done,
         stored: done
      }
   })

   const finished = elapsed >= offset

   return {
      phase: finished ? 'done' : cancelledAt ? 'cancelled' : 'running',
      startedAt,
      updatedAt: Date.now(),
      finishedAt: finished ? startedAt + offset : cancelledAt,
      steps,
      error: null,
      cancelRequested: Boolean(cancelledAt)
   }
}

function overview(id: FundingVenueId): FundingResponse {

   const venue = venues[id]
   const job = jobOf(venue)

   if (job?.phase === 'done' && job.finishedAt! > (venue.lastSyncedAt ?? 0)) venue.lastSyncedAt = job.finishedAt

   return {
      movements: venue.lastSyncedAt ? venue.movements : [],
      lastSyncedAt: venue.lastSyncedAt,
      job
   }
}

function sync(id: FundingVenueId): FundingSyncResponse {

   const venue = venues[id]
   const running = jobOf(venue)
   if (running?.phase === 'running') return { job: running, alreadyRunning: true }

   venue.run = { startedAt: Date.now(), cancelledAt: null }
   return { job: jobOf(venue)!, alreadyRunning: false }
}

function cancel(id: FundingVenueId): FundingCancelResponse {

   const venue = venues[id]
   if (venue.run && jobOf(venue)?.phase === 'running') venue.run.cancelledAt = Date.now()
   return { job: jobOf(venue) }
}

export const fundingRoutes: Record<string, () => unknown> = Object.fromEntries(
   (Object.keys(venues) as FundingVenueId[]).flatMap(id => [
      [`/api/${id}/funding`, () => overview(id)],
      [`/api/${id}/funding/sync`, () => sync(id)],
      [`/api/${id}/funding/sync/cancel`, () => cancel(id)]
   ]))
