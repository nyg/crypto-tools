import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Loader2Icon, RefreshCwIcon, Trash2Icon } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import Field from '../lib/field'
import { SyncStatusBadge, phaseLabel } from './sync-status'
import { asLongDate } from '../../../utils/format'

const asFileSize = (bytes) => {
   if (!bytes) return '—'
   const units = ['B', 'kB', 'MB', 'GB']
   const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
   return `${(bytes / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`
}

export default function LedgerSyncCard({ state, job, isRunning, error, isStarting, onSync, onFullResync, onCancel, onClear }) {

   const [confirmingClear, setConfirmingClear] = useState(false)

   // While a run is in flight the phase says more than a badge would, and it has to
   // name the report as well: the phases repeat once per export.
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

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-6">
               <Field label="Data range">{dataRange}</Field>
               <Field
                  label="Last sync"
                  title={state?.lastSyncedAt ? new Date(state.lastSyncedAt).toISOString() : undefined}>
                  {state?.lastSyncedAt
                     ? `${formatDistanceToNow(state.lastSyncedAt)} ago`
                     : 'Never'}
               </Field>
               <Field label="Entries">{(state?.entryCount ?? 0).toLocaleString('en-GB')}</Field>
               <Field label="Trades">{(state?.tradeCount ?? 0).toLocaleString('en-GB')}</Field>
               <Field label="Database">{asFileSize(state?.dbSizeBytes)}</Field>
               <Field label="Account">
                  <span className="font-mono text-xs">{state?.apiKeyPrefix ? `${state.apiKeyPrefix}…` : '—'}</span>
               </Field>
            </div>

            {isRunning &&
               <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-3 md:grid-cols-4">
                  <Field label="Report">
                     <span className="font-mono text-xs">{job.reportId ?? '—'}</span>
                  </Field>
                  <Field label="Kraken status">{job.reportStatus ?? 'Queued'}</Field>
                  <Field label="Elapsed">{Math.round((job.updatedAt - job.startedAt) / 1000)}s</Field>
                  <Field label="Entries read">
                     {job.counts.stored > 0
                        ? `${job.counts.stored.toLocaleString('en-GB')} saved`
                        : (job.counts.parsed || 0).toLocaleString('en-GB')}
                  </Field>
               </div>}

            <div className="flex flex-wrap items-center gap-2">
               <Button size="sm" type="button" disabled={isRunning || isStarting} onClick={onSync}>
                  <RefreshCwIcon className="size-3.5" />
                  Sync
               </Button>
               <Button variant="secondary" size="sm" type="button" disabled={isRunning || isStarting} onClick={onFullResync}>
                  Full resync
               </Button>
               {isRunning &&
                  <Button variant="outline" size="sm" type="button" onClick={onCancel}>
                     Cancel
                  </Button>}
               <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  className="ml-auto text-destructive hover:text-destructive"
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
            </div>

            <p className="text-xs text-muted-foreground">
               <b>Sync</b> fetches everything since the last entry it holds, for both the ledger and
               your trade history. <b>Full resync</b> re-reads your whole history and refreshes
               entries Kraken has amended since — it never deletes anything. <b>Clear data</b> removes
               the entries and the trades behind the Closed Orders page.
            </p>

            {(error || job?.error) &&
               <Alert variant="destructive">
                  <AlertDescription>{error ?? job.error}</AlertDescription>
               </Alert>}

            {state?.otherAccounts?.length > 0 &&
               <p className="text-xs text-muted-foreground">
                  Entries from other API keys are also stored:{' '}
                  {state.otherAccounts.map(account =>
                     `${account.apiKeyPrefix || 'unknown'}… (${account.entryCount.toLocaleString('en-GB')})`
                  ).join(', ')}.
               </p>}

         </CardContent>
      </Card>
   )
}
