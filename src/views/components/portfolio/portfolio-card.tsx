import type { ReactNode } from 'react'
import { ArchiveIcon, ArrowRightLeftIcon, CircleMinusIcon, CirclePlusIcon, HistoryIcon, SlidersHorizontalIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import HoldingsTable from './holdings-table'
import type { SupertrendColumns } from './supertrend-cell'
import { asPoints, asQuoteAmount, asSignedPercent, asSignedQuoteAmount, profitColor } from './format'
import { asDaysAgo, asLocalTimestamp } from '../../../utils/format'
import type { PortfolioSummary } from '../../../types/api'
import type { Sort } from '../../../types/kraken'

interface PortfolioCardProps {
   portfolio: PortfolioSummary
   supertrend?: SupertrendColumns
   busy: boolean
   sort: Sort
   onSortChange: (sort: Sort) => void
   onDeposit: () => void
   onWithdraw: () => void
   onRebalance: () => void
   onEdit: () => void
   onHistory: () => void
   onArchive: () => void
}

const Stat = ({ label, children, className }: { label: string, children: ReactNode, className?: string }) =>
   <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('text-base font-medium tabular-nums', className)}>{children}</div>
   </div>

const ProfitStat = ({ label, value, percent, quote }: { label: string, value: string, percent: string | null, quote: string }) =>
   <Stat label={label} className={profitColor(value)}>
      {asSignedQuoteAmount(value, quote)}
      {percent !== null && <span className="ml-1.5 text-sm">({asSignedPercent(percent)})</span>}
   </Stat>

export default function PortfolioCard({
   portfolio, supertrend, busy, sort, onSortChange, onDeposit, onWithdraw, onRebalance, onEdit, onHistory, onArchive
}: PortfolioCardProps) {

   const empty = Number(portfolio.value) === 0
   const armedStops = portfolio.stops.filter(({ status }) => status === 'placed').length
   const brokenStops = portfolio.stops.filter(({ status }) => status === 'failed' || status === 'missing')

   return (
      <Card>
         <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
               {portfolio.name}
               <Badge variant="outline">{portfolio.quoteAsset}</Badge>
               <Badge variant="outline">band ±{asPoints(portfolio.band)} pt</Badge>
               {portfolio.lastRebalancedAt !== null &&
                  <Badge variant="outline" title={asLocalTimestamp(portfolio.lastRebalancedAt)}>
                     Rebalanced {asDaysAgo(portfolio.lastRebalancedAt)}
                  </Badge>}
               {portfolio.needsRebalance && <Badge variant="destructive">Needs rebalance</Badge>}
               {armedStops > 0 && <Badge variant="outline">{armedStops} stop{armedStops === 1 ? '' : 's'} armed</Badge>}
               {brokenStops.length > 0 &&
                  <Badge variant="destructive" title={brokenStops.map(({ error }) => error).filter(Boolean).join(' ')}>
                     {brokenStops.map(({ asset }) => asset).join(', ')} stop not on the exchange
                  </Badge>}
            </CardTitle>
         </CardHeader>
         <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
               <div className="flex flex-wrap gap-x-8 gap-y-3">
                  <Stat label="Value">{asQuoteAmount(portfolio.value, portfolio.quoteAsset)}</Stat>
                  <Stat label="Net deposited">{asQuoteAmount(portfolio.netInvested, portfolio.quoteAsset)}</Stat>
                  <ProfitStat
                     label="Unrealized P/L" value={portfolio.unrealized}
                     percent={portfolio.unrealizedPercent} quote={portfolio.quoteAsset} />
                  <ProfitStat
                     label="Realized P/L" value={portfolio.realized}
                     percent={portfolio.realizedPercent} quote={portfolio.quoteAsset} />
                  <Stat label="Fees paid">
                     {asQuoteAmount(portfolio.fees, portfolio.quoteAsset)}
                     {portfolio.feesUnvalued.length > 0 &&
                        <span
                           className="ml-1.5 text-sm text-muted-foreground"
                           title="Fees paid in a coin whose price at the time of the trade was not recorded.">
                           + {portfolio.feesUnvalued.join(', ')}
                        </span>}
                  </Stat>
                  <Stat
                     label="Largest drift"
                     className={Number(portfolio.maxDrift) > Number(portfolio.band)
                        ? 'text-destructive'
                        : 'text-emerald-600 dark:text-emerald-400'}>
                     {asPoints(portfolio.maxDrift)} pt
                  </Stat>
               </div>
               <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={busy} onClick={onDeposit}>
                     <CirclePlusIcon /> Deposit
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy || empty} onClick={onWithdraw}>
                     <CircleMinusIcon /> Withdraw
                  </Button>
                  <Button size="sm" disabled={busy || empty} onClick={onRebalance}>
                     <ArrowRightLeftIcon /> Rebalance
                  </Button>
                  <Button size="icon-sm" variant="ghost" title="Edit targets" onClick={onEdit}>
                     <SlidersHorizontalIcon /><span className="sr-only">Edit targets</span>
                  </Button>
                  <Button size="icon-sm" variant="ghost" title="History" onClick={onHistory}>
                     <HistoryIcon /><span className="sr-only">History</span>
                  </Button>
                  <Button size="icon-sm" variant="ghost" title="Archive" disabled={busy} onClick={onArchive}>
                     <ArchiveIcon /><span className="sr-only">Archive</span>
                  </Button>
               </div>
            </div>
            {portfolio.holdings.length > 0 &&
               <HoldingsTable portfolio={portfolio} supertrend={supertrend} sort={sort} onSortChange={onSortChange} />}
         </CardContent>
      </Card>
   )
}
