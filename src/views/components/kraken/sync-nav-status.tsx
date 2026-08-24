import { Link } from 'react-router'
import useSWR from 'swr'
import { formatDistanceToNow } from 'date-fns'
import { Loader2Icon } from 'lucide-react'
import { isJobRunning } from './sync-status'
import { useProvider } from '../../lib/use-settings'
import type { SyncStatusResponse } from '../../../types/api'

// The one fact every Kraken page is read against — how old the stored data is — kept
// out of the pages themselves and shown once, beside the tabs. Which step of a run is
// in flight stays on the Ledger page: there is room for a phase there and none here.
export default function SyncNavStatus() {

   const { configured } = useProvider('kraken')

   const { data } = useSWR<SyncStatusResponse>(
      configured ? '/api/kraken/ledger/sync/status' : null,
      { refreshInterval: latest => isJobRunning(latest?.job) ? 1500 : 0 })

   if (!data) return null

   const lastSyncedAt = data.state?.lastSyncedAt

   return (
      <Link
         to="/kraken/ledger"
         title={lastSyncedAt ? new Date(lastSyncedAt).toISOString() : undefined}
         className="flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground">
         {isJobRunning(data.job)
            ? <>
               <Loader2Icon className="size-3.5 animate-spin" />
               Syncing…
            </>
            : `Last sync: ${lastSyncedAt ? `${formatDistanceToNow(lastSyncedAt)} ago` : 'never'}`}
      </Link>
   )
}
