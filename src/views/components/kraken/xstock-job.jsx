import { Loader2Icon, XIcon } from 'lucide-react'
import { asCount } from '../lib/filter-options'

const terminalPhases = ['done', 'error', 'cancelled']
const settledPhases = ['done', 'error', 'cancelled', 'skipped']

export const isJobRunning = job => Boolean(job) && !terminalPhases.includes(job.phase)

export const jobVerbs = {
   describe: { action: 'describe', gerund: 'describing', present: 'Describing', past: 'Described' },
   classify: { action: 'classify', gerund: 'classifying', present: 'Classifying', past: 'Classified' }
}

export function jobCounts(job) {
   const steps = job?.steps ?? []
   return {
      total: steps.length,
      done: steps.filter(step => step.phase === 'done').length,
      failed: steps.filter(step => step.phase === 'error').length,
      settled: steps.filter(step => settledPhases.includes(step.phase)).length,
      running: steps.filter(step => step.phase === 'running')
   }
}

export const describingTickers = job =>
   new Set(jobCounts(job).running.map(step => step.ticker))

const elapsedSeconds = (job) => {
   const end = isJobRunning(job) ? Date.now() : (job.finishedAt ?? job.startedAt)
   return Math.max(0, Math.round((end - job.startedAt) / 1000))
}

export default function XStockJobProgress({ job }) {

   if (!job) return null

   const running = isJobRunning(job)
   const counts = jobCounts(job)
   const failures = (job.steps ?? []).filter(step => step.phase === 'error')

   if (!running && failures.length === 0) return null

   const verbs = jobVerbs[job.kind] ?? jobVerbs.describe
   const percent = counts.total === 0 ? 0 : Math.round((counts.settled / counts.total) * 100)

   return (
      <div className="space-y-3 rounded-md border border-border bg-muted/40 p-3">

         <div className="flex items-baseline justify-between gap-4 text-sm">
            <span className="font-medium">
               {running
                  ? `${verbs.present} ${counts.settled} of ${counts.total}`
                  : `${verbs.past} ${counts.done} of ${counts.total}`}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{elapsedSeconds(job)}s</span>
         </div>

         <div className="h-1.5 overflow-hidden rounded-full bg-border">
            <div
               className="h-full rounded-full bg-primary transition-[width] duration-500"
               style={{ width: `${percent}%` }} />
         </div>

         {counts.running.length > 0 &&
            <ul className="space-y-1.5">
               {counts.running.map(step =>
                  <li key={step.ticker} className="flex items-baseline gap-2 text-sm">
                     <Loader2Icon className="size-3.5 shrink-0 translate-y-0.5 animate-spin text-muted-foreground" />
                     <span className="w-16 shrink-0 truncate font-medium" title={step.ticker}>{step.ticker}</span>
                     <span className="min-w-0 flex-1 truncate text-muted-foreground" title={step.activity}>
                        {step.activity || 'Waiting for Claude…'}
                     </span>
                  </li>)}
            </ul>}

         {failures.length > 0 &&
            <div className="space-y-1.5 border-t border-border pt-3">
               <p className="text-sm text-destructive">
                  {asCount(failures.length, 'listing')} Claude could not {verbs.action}.
               </p>
               <ul className="space-y-1">
                  {failures.map(step =>
                     <li key={step.ticker} className="flex items-baseline gap-2 text-xs">
                        <XIcon className="size-3 shrink-0 translate-y-0.5 text-destructive" />
                        <span className="w-16 shrink-0 truncate font-medium" title={step.ticker}>{step.ticker}</span>
                        <span className="min-w-0 flex-1 text-muted-foreground">{step.error}</span>
                     </li>)}
               </ul>
            </div>}

      </div>
   )
}
