import { Badge } from '@/components/ui/badge'

const terminalPhases = ['done', 'error', 'cancelled']

// Mirrors the server's finished step phases: 'pending' is a step that has not started,
// anything else outside this list is one Kraken is working on.
const finishedStepPhases = ['done', 'error', 'cancelled', 'skipped']

export const isJobRunning = job => Boolean(job) && !terminalPhases.includes(job.phase)

export const isStepRunning = step =>
   Boolean(step) && step.phase !== 'pending' && !finishedStepPhases.includes(step.phase)

// What each report is called on screen. The server names them the way Kraken's API
// does, which is not what the rest of the app calls them.
export const reportLabels = { ledgers: 'Ledger entries', trades: 'Trades' }

const stepLabels = {
   pending: 'Queued',
   requesting: 'Requesting export…',
   waiting: 'Kraken is preparing the export…',
   downloading: 'Downloading export…',
   parsing: 'Reading rows…',
   storing: 'Saving rows…',
   cleaning: 'Removing the export from Kraken…',
   done: 'Done',
   skipped: 'Not run',
   cancelled: 'Cancelled',
   error: 'Failed'
}

export const stepLabel = step => stepLabels[step?.phase] ?? 'Syncing…'

export const runningStep = job => job?.steps?.find(isStepRunning) ?? null

// One line for the pages that only have room for one: whichever report is in flight,
// named, because the same phases run twice and would otherwise look like a restart.
export function phaseLabel(job) {
   const step = runningStep(job)
   if (!step) return 'Syncing…'
   return `${stepLabel(step)} (${reportLabels[step.report] ?? step.report})`
}

// Only states that can actually be known get a badge, and only where nothing else
// already says it. A run that finished used to earn a "Synced" badge, which claimed
// more than it knew: nothing here can tell whether Kraken has rows newer than the
// last run — the watermark is what was downloaded, not what exists — so it only ever
// meant "the last run did not fail", which the steps and the last-synced time say
// between them. A run that did fail is worth flagging, because nothing else does.
export function SyncStatusBadge({ state, job, isRunning }) {

   if (isRunning) return <Badge variant="secondary">Syncing</Badge>
   if (job?.phase === 'error') return <Badge variant="destructive">Failed</Badge>
   if (job?.phase === 'cancelled') return <Badge variant="outline">Cancelled</Badge>
   // Read from the stored watermark rather than from the job, so that clearing the
   // data goes back to "never synced" instead of staying quiet on the strength of a
   // finished run whose rows are gone.
   if (state?.lastSyncedAt) return null

   return <Badge variant="outline">Never synced</Badge>
}
