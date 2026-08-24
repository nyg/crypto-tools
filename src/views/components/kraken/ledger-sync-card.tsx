import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Loader2Icon, RefreshCwIcon, Trash2Icon } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import Field from '../lib/field'
import SyncSteps from './sync-steps'
import { asCount } from '../lib/filter-options'
import { SyncStatusBadge, phaseLabel } from './sync-status'
import { asNumber, asLongDate } from '../../../utils/format'
import type { SyncState } from '../../../types/api'
import type { SyncJob } from '../../../types/jobs'
import { messageOf } from '@/lib/errors'

const asFileSize = (bytes: number | undefined) => {
   if (!bytes) return '—'
   const units = ['B', 'kB', 'MB', 'GB']
   const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
   return `${(bytes / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`
}

export default function LedgerSyncCard({
   state, job, isRunning, error, isStarting, onSync, onFullResync, onCancel, onClear
}: {
   state?: SyncState | null
   job?: SyncJob | null
   isRunning?: boolean
   error?: unknown
   isStarting?: boolean
   onSync: () => void
   onFullResync: () => void
   onCancel: () => void
   onClear: () => void
}) {

   const [confirmingClear, setConfirmingClear] = useState(false)

   // While a run is in flight the phase says more than a badge would. Which report it
   // belongs to is left to the step rows below, which show both at once.
   const statusIndicator = isRunning
      ? <span className="flex items-center gap-1.5 text-sm font-normal text-muted-foreground">
         <Loader2Icon className="size-4 animate-spin" />
         {phaseLabel(job)}
      </span>
      : <SyncStatusBadge state={state} job={job} isRunning={isRunning} />

   const dataRange = state?.coveredFrom && state?.coveredTo
      ? `${asLongDate(state.coveredFrom)} — ${asLongDate(state.coveredTo)}`
      : '—'

   return (
      <Card>
         <CardHeader>
            <CardTitle>Sync</CardTitle>
            <CardAction>{statusIndicator}</CardAction>
         </CardHeader>
         <CardContent className="space-y-4">

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
               <Field label="Data range">{dataRange}</Field>
               <Field
                  label="Last sync"
                  title={state?.lastSyncedAt ? new Date(state.lastSyncedAt).toISOString() : undefined}>
                  {state?.lastSyncedAt
                     ? `${formatDistanceToNow(state.lastSyncedAt)} ago`
                     : 'Never'}
               </Field>
               {/* One field rather than two: the split between them is what the step
                   rows below are for, and six labels made the card read as a form. */}
               <Field label="Stored">
                  {asCount(state?.entryCount ?? 0, 'entry', 'entries')} · {asCount(state?.tradeCount ?? 0, 'trade')}
               </Field>
               <Field label="Database">{asFileSize(state?.dbSizeBytes)}</Field>
            </div>

            {/* Full width of the card rather than a bordered box inside it, so the run
                reads as its own band between the stored figures and the actions. Kept
                after the run as well: it is the only place that says how much of what
                was downloaded was actually new. */}
            <SyncSteps job={job} />

            <div className="flex flex-wrap items-center gap-2">
               <Button size="sm" type="button" disabled={isRunning || isStarting} onClick={onSync}>
                  <RefreshCwIcon className="size-3.5" />
                  Sync
               </Button>
               <Button variant="secondary" size="sm" type="button" disabled={isRunning || isStarting} onClick={onFullResync}>
                  Full resync
               </Button>
               {/* Alongside the other two rather than pushed to the far edge: it is one
                   of the three things this card does, and the destructive variant is
                   what marks it out. */}
               <Button
                  variant="destructive"
                  size="sm"
                  type="button"
                  className="border-destructive/40"
                  disabled={isRunning}
                  onClick={() => {
                     if (confirmingClear) {
                        onClear()
                        setConfirmingClear(false)
                     }
                     else {
                        setConfirmingClear(true)
                     }
                  }}
                  onBlur={() => setConfirmingClear(false)}>
                  <Trash2Icon className="size-3.5" />
                  {confirmingClear ? 'Click again to confirm' : 'Clear data'}
               </Button>
               {/* Last, and only while there is something to cancel, so the three
                   buttons above never move under the pointer mid-run. */}
               {isRunning &&
                  <Button variant="outline" size="sm" type="button" onClick={onCancel}>
                     Cancel
                  </Button>}
            </div>

            <p className="text-xs text-muted-foreground">
               <b>Sync</b> fetches everything since the last row it holds, as two exports: your
               ledger, then your trade history. Each export is deleted from Kraken as soon as its
               rows are stored. <b>Full resync</b> re-reads your whole history and refreshes rows
               Kraken has amended since — it never deletes anything. <b>Clear data</b> empties the
               entries and the trades behind the Aggregated Trades page, leaving the database
               itself in place.
            </p>

            {/* A failure the steps already carry is not repeated here; this is for the
                ones that belong to no step, such as the request to start being refused. */}
            {(error || (job?.error && !job.steps?.some(step => step.error))) &&
               <Alert variant="destructive">
                  <AlertDescription>{messageOf(error ?? job?.error)}</AlertDescription>
               </Alert>}

            {(state?.otherAccounts?.length ?? 0) > 0 &&
               <p className="text-xs text-muted-foreground">
                  Entries from other API keys are also stored:{' '}
                  {state!.otherAccounts.map(account =>
                     `${account.apiKeyPrefix || 'unknown'}… (${asNumber(account.entryCount)})`
                  ).join(', ')}.
               </p>}

         </CardContent>
      </Card>
   )
}
