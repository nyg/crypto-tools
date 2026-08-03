import { CheckIcon, CircleIcon, Loader2Icon, MinusIcon, XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isStepRunning, reportLabels, stepLabel } from './sync-status'

const asCount = value => (value ?? 0).toLocaleString('en-GB')

// A sync downloads two exports, one after the other. Both are shown for the whole run
// and afterwards, so that the ledger's progress does not disappear the moment the
// trades export starts and the finished run says what each of them did.
export default function SyncSteps({ job }) {

   if (!job?.steps?.length) return null

   return (
      <div className="divide-y divide-border rounded-lg border border-border">
         {job.steps.map(step => <SyncStep key={step.report} step={step} job={job} />)}
      </div>
   )
}

function SyncStep({ step, job }) {

   const running = isStepRunning(step)

   // A step that is still going is timed against the last status the server sent, so
   // the number moves with the polling rather than with this browser's clock.
   const elapsed = step.startedAt
      ? Math.max(0, Math.round(((step.finishedAt ?? job.updatedAt) - step.startedAt) / 1000))
      : null

   return (
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2.5 text-sm">

         <span className="flex items-center gap-2 font-medium">
            <StepIcon step={step} running={running} />
            {reportLabels[step.report] ?? step.report}
         </span>

         <span className={cn('text-muted-foreground', step.phase === 'error' && 'text-destructive')}>
            {stepLabel(step)}
         </span>

         <span className="ml-auto flex items-baseline gap-3 tabular-nums text-muted-foreground">
            <StepCounts step={step} running={running} />
            {elapsed !== null && <span className="w-12 text-right">{elapsed}s</span>}
         </span>

         {/* The report id is what Kraken's own export page lists a run under, so it is
             worth showing while there is still something to look up. */}
         {running && step.reportId &&
            <span className="w-full font-mono text-xs text-muted-foreground">
               {step.reportId}
               {step.reportStatus && <> · {step.reportStatus}</>}
               {step.pollCount > 0 && <> · checked {step.pollCount}×</>}
            </span>}

         {step.error &&
            <span className="w-full text-xs text-destructive">{step.error}</span>}

      </div>
   )
}

function StepIcon({ step, running }) {

   if (running) return <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
   if (step.phase === 'done') return <CheckIcon className="size-4 text-emerald-600 dark:text-emerald-500" />
   if (step.phase === 'error') return <XIcon className="size-4 text-destructive" />
   if (step.phase === 'cancelled' || step.phase === 'skipped') {
      return <MinusIcon className="size-4 text-muted-foreground" />
   }

   return <CircleIcon className="size-4 text-muted-foreground/40" />
}

// What the step has to say about its rows, which is a different number at every stage:
// nothing before the download, a running total while it saves, and what changed once
// it is over.
function StepCounts({ step, running }) {

   const { parsed, stored, inserted, skipped } = step.counts ?? {}

   if (step.phase === 'storing') {
      return <span>{asCount(stored)} of {asCount(parsed)} saved</span>
   }

   if (running || step.phase === 'pending') {
      return parsed > 0 ? <span>{asCount(parsed)} rows</span> : null
   }

   if (step.phase !== 'done') return null

   return (
      <span>
         {asCount(parsed)} read · {asCount(inserted)} new
         {skipped > 0 && <> · {asCount(skipped)} skipped</>}
      </span>
   )
}
