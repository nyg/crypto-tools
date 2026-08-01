import { Badge } from '@/components/ui/badge'

const terminalPhases = ['done', 'error', 'cancelled']

export const isJobRunning = job => Boolean(job) && !terminalPhases.includes(job.phase)

const phaseLabels = {
   requesting: 'Requesting export…',
   waiting: 'Kraken is preparing the export…',
   downloading: 'Downloading export…',
   parsing: 'Reading entries…',
   storing: 'Saving entries…',
   cleaning: 'Cleaning up…'
}

// A run walks the same phases twice, once per report, so the label says which one is
// in flight — otherwise the progress appears to start over halfway through.
export function phaseLabel(job) {
   const label = phaseLabels[job?.phase]
   if (!label) return 'Syncing…'
   return job?.report ? `${label} (${job.report})` : label
}

export function SyncStatusBadge({ state, job, isRunning }) {

   if (isRunning) return <Badge variant="secondary">Syncing</Badge>
   if (job?.phase === 'error') return <Badge variant="destructive">Failed</Badge>
   if (job?.phase === 'cancelled') return <Badge variant="outline">Cancelled</Badge>
   if (job?.phase === 'done') return <Badge>Synced</Badge>
   if (state?.lastSyncedAt) return <Badge variant="secondary">Up to date</Badge>

   return <Badge variant="outline">Never synced</Badge>
}
