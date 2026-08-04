import { Loader2Icon, RefreshCwIcon } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Field from '../lib/field'
import { asCount } from '../lib/filter-options'
import { asDollarAmount, asPercentage } from '../../../utils/format'
import { isEarning, placementOf } from './placement'

// Kraken and the ledger agree to far more digits than this; the tolerance is relative
// so that it means the same thing for a fraction of a bitcoin and for 300 million PEPE.
const TOLERANCE = 1e-6

// Which assets the stored ledger no longer agrees with Kraken about. Anything here
// means the ledger is behind — the sync is incremental and the page cannot tell on its
// own that something happened after the last one.
export function compareToLive(assets, live) {

   if (!live?.assets) return null

   const ledger = new Map((assets ?? []).map(asset => [asset.asset, asset.totalNum]))
   const remote = new Map(live.assets.map(asset => [asset.asset, asset.totalNum]))

   return [...new Set([...ledger.keys(), ...remote.keys()])]
      .map(asset => ({ asset, ledger: ledger.get(asset) ?? 0, live: remote.get(asset) ?? 0 }))
      .filter(({ ledger, live }) => {
         const scale = Math.max(Math.abs(ledger), Math.abs(live))
         return scale > 0 && Math.abs(ledger - live) / scale > TOLERANCE
      })
      .toSorted((a, b) => a.asset.localeCompare(b.asset))
}


export default function BalanceSummaryCard({ balances, rates, live, liveError, isLoading, isLoadingRates, isLoadingLive, onRefreshLive }) {

   const assets = balances?.assets ?? []
   const valueOf = asset => rates?.[asset.asset] == null ? null : asset.totalNum * rates[asset.asset]

   const valued = assets.filter(asset => valueOf(asset) != null)
   const totalValue = valued.reduce((sum, asset) => sum + valueOf(asset), 0)

   // Split by whether the coins are being paid anything, which is the question the
   // page exists to answer — not by spot against earn, since an opted-in holding is both.
   const earningValue = valued.reduce((sum, asset) => sum + asset.positions
      .filter(position => isEarning(placementOf(position)))
      .reduce((value, position) => value + position.amountNum * rates[asset.asset], 0), 0)

   const holdValue = (live?.assets ?? [])
      .filter(asset => rates?.[asset.asset] != null)
      .reduce((sum, asset) => sum + asset.holdNum * rates[asset.asset], 0)

   const drifted = compareToLive(assets, live)

   return (
      <Card>
         <CardHeader>
            <CardTitle>Portfolio</CardTitle>
            <CardAction>
               {isLoading
                  ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                  : <Badge variant="outline">{asCount(balances?.positions, 'position')}</Badge>}
            </CardAction>
         </CardHeader>
         <CardContent className="space-y-4">

            <div className="grid grid-cols-2 gap-x-6 gap-y-6">
               <Field
                  label="Worth today"
                  title={valued.length < assets.length
                     ? `${assets.length - valued.length} asset(s) have no USD pair and are not counted`
                     : undefined}>
                  {isLoadingRates
                     ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                     : rates ? asDollarAmount(totalValue) : '—'}
               </Field>
               <Field label="Assets held">{assets.length.toLocaleString()}</Field>
               <Field label="Earning">
                  {isLoadingRates
                     ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                     : rates
                        ? <>
                           {asDollarAmount(earningValue)}
                           {totalValue > 0 &&
                              <span className="ml-2 text-xs text-muted-foreground">
                                 {asPercentage(earningValue / totalValue)}
                              </span>}
                        </>
                        : '—'}
               </Field>
               <Field
                  label="In open orders"
                  title="Reserved by orders still on the book, read from Kraken — the ledger only learns about an order once it fills.">
                  {isLoadingLive
                     ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                     : live ? asDollarAmount(holdValue) : '—'}
               </Field>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-3 text-xs">

               <span className="text-muted-foreground">
                  {isLoadingLive ? 'Checking against Kraken…'
                     : liveError ? `Could not reach Kraken: ${liveError}`
                        : !live ? 'Not checked against Kraken.'
                           : drifted.length === 0
                              ? `Matches Kraken exactly, checked ${formatDistanceToNow(live.fetchedAt)} ago.`
                              : `${asCount(drifted.length, 'asset')} ${drifted.length === 1 ? 'differs' : 'differ'} from Kraken — sync the ledger to catch up: ${drifted.slice(0, 3).map(entry => entry.asset).join(', ')}${drifted.length > 3 ? '…' : ''}`}
               </span>

               <Button
                  variant="ghost"
                  size="xs"
                  className="ml-auto"
                  disabled={isLoadingLive}
                  onClick={onRefreshLive}>
                  <RefreshCwIcon className="size-3.5" />
                  Check Kraken
               </Button>

            </div>

         </CardContent>
      </Card>
   )
}
