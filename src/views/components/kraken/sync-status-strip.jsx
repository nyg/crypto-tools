import { Link } from 'react-router'
import { formatDistanceToNow } from 'date-fns'
import { Loader2Icon } from 'lucide-react'
import { SyncStatusBadge, phaseLabel } from './sync-status'
import { asCount } from '../lib/filter-options'

// Read-only counterpart to the Ledger page's sync card: the controls live there, so
// that there is one place a sync is started from and one watermark to reason about.
export default function SyncStatusStrip({ state, job, isRunning }) {

   return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border px-4 py-2.5 text-sm">

         <SyncStatusBadge state={state} job={job} isRunning={isRunning} />

         {isRunning
            ? <span className="flex items-center gap-1.5 text-muted-foreground">
               <Loader2Icon className="size-4 animate-spin" />
               {phaseLabel(job)}
            </span>
            : <span className="text-muted-foreground">
               {state?.lastSyncedAt
                  ? `Last synced ${formatDistanceToNow(state.lastSyncedAt)} ago`
                  : 'No trade history stored yet'}
            </span>}

         <span className="tabular-nums text-muted-foreground">
            {asCount(state?.orderCount, 'order')} · {asCount(state?.tradeCount, 'trade')}
         </span>

         <Link to="/kraken/ledger" className="ml-auto underline underline-offset-4">
            Sync in Ledger
         </Link>
      </div>
   )
}
