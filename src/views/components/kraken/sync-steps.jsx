import { CheckIcon, CircleIcon, Loader2Icon, MinusIcon, XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isStepRunning, reportLabels, stepLabel } from './sync-status'

const asCount = value => (value ?? 0).toLocaleString()

// A sync downloads two exports, one after the other. Both are shown for the whole run
// and afterwards, so that the ledger's progress does not disappear the moment the
// trades export starts and the finished run says what each of them did.
export default function SyncSteps({ job }) {

   if (!job?.steps?.length) return null

   // Bled to the card's edges and given a tint of its own: nested inside a border it
   // read as a box within a box, and the phases of the two reports have to line up
   // vertically to be comparable at a glance.
   return (
      <div className="-mx-4 divide-y divide-border border-y border-border bg-muted/40 group-data-[size=sm]/card:-mx-3">
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
      <div className="px-4 py-2.5 text-sm group-data-[size=sm]/card:px-3">

         {/* The report name holds a column of its own so that every phase label starts
             at the same x, whatever the name in front of it is. */}
         <div className="grid grid-cols-[1rem_minmax(0,1fr)] items-center gap-x-3 sm:grid-cols-[1rem_9rem_minmax(0,1fr)]">

            <StepIcon step={step} running={running} />

            <span className="font-medium">{reportLabels[step.report] ?? step.report}</span>

            <div className="col-span-2 flex items-baseline justify-between gap-x-4 gap-y-1 sm:col-span-1">
               <span className={cn('text-muted-foreground', step.phase === 'error' && 'text-destructive')}>
                  {stepLabel(step)}
               </span>
               <span className="flex shrink-0 items-baseline gap-4 tabular-nums text-muted-foreground">
                  <StepCounts step={step} running={running} />
                  {elapsed !== null && <span className="w-10 text-right">{elapsed}s</span>}
               </span>
            </div>

         </div>

         {/* The report id is what Kraken's own export page lists a run under, so it is
             worth showing while there is still something to look up. Indented to the
             name column, so it hangs off the row it belongs to. */}
         {running && step.reportId &&
            <p className="mt-1 font-mono text-xs text-muted-foreground sm:pl-[1.75rem]">
               {step.reportId}
               {step.reportStatus && <> · {step.reportStatus}</>}
               {step.pollCount > 0 && <> · checked {step.pollCount}×</>}
            </p>}

         {step.error &&
            <p className="mt-1 text-xs text-destructive sm:pl-[1.75rem]">{step.error}</p>}

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
