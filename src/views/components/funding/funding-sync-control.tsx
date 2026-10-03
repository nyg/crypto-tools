import { Loader2Icon, RefreshCwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import TimeAgo from '../lib/time-ago'
import { asLocalTimestamp } from '../../../utils/format'
import type { FundingJob } from '../../../types/jobs'

export const isFundingSyncing = (job: FundingJob | null | undefined): boolean => job?.phase === 'running'

function progressOf(job: FundingJob): string {
   const step = job.steps.find(({ phase }) => phase === 'running')
   if (!step) return 'Starting…'
   return step.windows > 1
      ? `${step.label}: ${step.windowsDone} of ${step.windows} periods`
      : `${step.label}…`
}

export default function FundingSyncControl({ job, lastSyncedAt, isStarting, onSync, onCancel }: {
   job: FundingJob | null | undefined
   lastSyncedAt: number | null | undefined
   isStarting: boolean
   onSync: () => void
   onCancel: () => void
}) {

   if (job && isFundingSyncing(job)) {
      return (
         <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            <span>{progressOf(job)}</span>
            <Button variant="ghost" size="sm" disabled={job.cancelRequested} onClick={onCancel}>
               {job.cancelRequested ? 'Cancelling…' : 'Cancel'}
            </Button>
         </div>
      )
   }

   return (
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
         <span className="hidden sm:inline" title={lastSyncedAt ? asLocalTimestamp(lastSyncedAt) : undefined}>
            Last sync: {lastSyncedAt ? <TimeAgo time={lastSyncedAt} /> : 'never'}
         </span>
         <Button variant="outline" size="sm" disabled={isStarting} onClick={onSync}>
            <RefreshCwIcon /> Sync
         </Button>
      </div>
   )
}
