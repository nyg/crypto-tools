import type { ReactNode } from 'react'
import { ArchiveIcon, ArrowRightLeftIcon, CircleMinusIcon, CirclePlusIcon, HistoryIcon, SlidersHorizontalIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import HoldingsTable from './holdings-table'
import { asDecimal } from '../../../utils/format'
import { asQuoteAmount, asSignedQuoteAmount } from './format'
import type { PortfolioSummary } from '../../../types/api'

interface PortfolioCardProps {
   portfolio: PortfolioSummary
   busy: boolean
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

export default function PortfolioCard({
   portfolio, busy, onDeposit, onWithdraw, onRebalance, onEdit, onHistory, onArchive
}: PortfolioCardProps) {

   const profit = Number(portfolio.profit)
   const empty = Number(portfolio.value) === 0

   return (
      <Card>
         <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
               {portfolio.name}
               <Badge variant="outline">{portfolio.quoteAsset}</Badge>
               <Badge variant="outline">band ±{asDecimal(Number(portfolio.band), 1)} pt</Badge>
               {portfolio.needsRebalance && <Badge variant="destructive">Needs rebalance</Badge>}
            </CardTitle>
         </CardHeader>
         <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
               <div className="flex flex-wrap gap-x-8 gap-y-3">
                  <Stat label="Value">{asQuoteAmount(portfolio.value, portfolio.quoteAsset)}</Stat>
                  <Stat label="Net deposited">{asQuoteAmount(portfolio.netInvested, portfolio.quoteAsset)}</Stat>
                  <Stat
                     label="Profit / loss"
                     className={cn(profit > 0 && 'text-emerald-600 dark:text-emerald-400', profit < 0 && 'text-destructive')}>
                     {asSignedQuoteAmount(portfolio.profit, portfolio.quoteAsset)}
                  </Stat>
                  <Stat
                     label="Largest drift"
                     className={Number(portfolio.maxDrift) > Number(portfolio.band)
                        ? 'text-destructive'
                        : 'text-emerald-600 dark:text-emerald-400'}>
                     {asDecimal(Number(portfolio.maxDrift), 2)} pt
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
            {portfolio.holdings.length > 0 && <HoldingsTable portfolio={portfolio} />}
         </CardContent>
      </Card>
   )
}
