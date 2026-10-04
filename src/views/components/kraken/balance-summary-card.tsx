import { Loader2Icon, RefreshCwIcon } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Field from '../lib/field'
import TimeAgo from '../lib/time-ago'
import { asCount } from '../lib/filter-options'
import { asDollarAmount, asNumber, asPercentage } from '../../../utils/format'
import { isEarning, placementOf } from './placement'
import type { BalanceSummary, BalancesResponse } from '../../../types/api'
import type { LiveBalance, UsdRates } from '../../../types/kraken'

// Kraken and the ledger agree to far more digits than this; the tolerance is relative
// so that it means the same thing for a fraction of a bitcoin and for 300 million PEPE.
const TOLERANCE = 1e-6

// Which assets the stored ledger no longer agrees with Kraken about. Anything here
// means the ledger is behind — the sync is incremental and the page cannot tell on its
// own that something happened after the last one.
export function compareToLive(ledgerSummary: BalanceSummary | undefined, live: BalancesResponse | undefined) {

   if (!live?.assets || !ledgerSummary?.entries) return null

   const ledger = new Map(ledgerSummary.assets.map(asset => [asset.asset, asset.totalNum]))
   const remote = new Map(live.assets.map(asset => [asset.asset, asset.totalNum]))

   return [...new Set([...ledger.keys(), ...remote.keys()])]
      .map(asset => ({ asset, ledger: ledger.get(asset) ?? 0, live: remote.get(asset) ?? 0 }))
      .filter(({ ledger, live }) => {
         const scale = Math.max(Math.abs(ledger), Math.abs(live))
         return scale > 0 && Math.abs(ledger - live) / scale > TOLERANCE
      })
      .toSorted((a, b) => a.asset.localeCompare(b.asset))
}


export default function BalanceSummaryCard({
   ledger, rates, live, liveError, isLoadingRates, isLoadingLive, onRefreshLive
}: {
   ledger?: BalanceSummary
   rates?: UsdRates
   live?: BalancesResponse
   liveError?: unknown
   isLoadingRates?: boolean
   isLoadingLive?: boolean
   onRefreshLive: () => void
}) {

   const assets = live?.assets ?? []
   const positions = assets.reduce((count, asset) => count + asset.positions.length, 0)
   const priced = rates ?? {}
   const valueOf = (asset: LiveBalance) => {
      const rate = priced[asset.asset]
      return rate == null ? null : asset.totalNum * rate
   }

   const valued = assets.filter(asset => valueOf(asset) != null)
   const totalValue = valued.reduce((sum, asset) => sum + (valueOf(asset) ?? 0), 0)

   // Split by whether the coins are being paid anything, which is the question the
   // page exists to answer — not by spot against earn, since an opted-in holding is both.
   const earningValue = valued.reduce((sum, asset) => sum + asset.positions
      .filter(position => isEarning(placementOf(position)))
      .reduce((value, position) => value + position.amountNum * (priced[asset.asset] ?? 0), 0), 0)

   const holdValue = assets
      .filter(asset => priced[asset.asset] != null)
      .reduce((sum, asset) => sum + asset.holdNum * (priced[asset.asset] ?? 0), 0)

   const drifted = compareToLive(ledger, live)

   return (
      <Card>
         <CardHeader>
            <CardTitle>Portfolio</CardTitle>
            <CardAction>
               {isLoadingLive
                  ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                  : <Badge variant="outline">{asCount(positions, 'position')}</Badge>}
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
               <Field label="Assets held">{asNumber(assets.length)}</Field>
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
                  title="Reserved by orders still on the book.">
                  {isLoadingLive
                     ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                     : live ? asDollarAmount(holdValue) : '—'}
               </Field>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-3 text-xs">

               <span className="text-muted-foreground">
                  {isLoadingLive ? 'Reading balances from Kraken…'
                     : liveError ? 'Could not reach Kraken.'
                        : !live ? 'Not read from Kraken yet.'
                           : !drifted ? <>Read from Kraken <TimeAgo time={live.fetchedAt} />.</>
                              : drifted.length === 0
                                 ? <>Read from Kraken <TimeAgo time={live.fetchedAt} />, and the stored ledger matches it.</>
                                 : `${asCount(drifted.length, 'asset')} ${drifted.length === 1 ? 'differs' : 'differ'} from the stored ledger — sync it to catch up: ${drifted.slice(0, 3).map(entry => entry.asset).join(', ')}${drifted.length > 3 ? '…' : ''}`}
               </span>

               <Button
                  variant="ghost"
                  size="xs"
                  className="ml-auto"
                  disabled={isLoadingLive}
                  onClick={onRefreshLive}>
                  <RefreshCwIcon className="size-3.5" />
                  Refresh
               </Button>

            </div>

         </CardContent>
      </Card>
   )
}
