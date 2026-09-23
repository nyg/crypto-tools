import { cn } from '@/lib/utils'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
   asDrift, asQuantity, asQuoteAmount, asSignedPercent, asSignedQuoteAmount, asWeight, profitColor,
   showsAsZeroQuoteAmount, stopStatusLabels
} from './format'
import SortableHead from '../lib/sortable-head'
import { numericKey, sortRows } from '../../lib/sort'
import type { SortKeys } from '../../lib/sort'
import type { PortfolioHolding, PortfolioSummary } from '../../../types/api'
import type { Sort } from '../../../types/kraken'

const ProfitCell = ({ value, percent = null, quote }: { value: string | null, percent?: string | null, quote: string }) =>
   <TableCell className={cn('text-right', profitColor(value))}>
      {asSignedQuoteAmount(value, quote)}
      {percent !== null && <span className="ml-1.5 text-xs">({asSignedPercent(percent)})</span>}
   </TableCell>

const StopCell = ({ holding }: { holding: PortfolioHolding }) =>
   <TableCell className="text-right">
      {holding.stopPrice === null ? '—' : asQuantity(holding.stopPrice)}
      {holding.stopStatus &&
         <span className={cn('ml-2 text-xs',
            holding.stopStatus === 'failed' || holding.stopStatus === 'missing'
               ? 'text-destructive'
               : 'text-muted-foreground')}>
            {stopStatusLabels[holding.stopStatus]}
         </span>}
   </TableCell>

interface HoldingsTableProps {
   portfolio: PortfolioSummary
   sort: Sort
   onSortChange: (sort: Sort) => void
}

export default function HoldingsTable({ portfolio, sort, onSortChange }: HoldingsTableProps) {

   const band = Number(portfolio.band)
   const quote = portfolio.quoteAsset

   const isCashOnly = (holding: PortfolioHolding) => holding.asset === quote && Number(holding.target) === 0
   const unlessCashOnly = (key: (holding: PortfolioHolding) => number | null) =>
      (holding: PortfolioHolding) => isCashOnly(holding) ? null : key(holding)

   const sortKeys: SortKeys<PortfolioHolding> = {
      asset: holding => holding.asset,
      target: unlessCashOnly(holding => Number(holding.target)),
      weight: unlessCashOnly(holding => numericKey(holding.weight)),
      drift: unlessCashOnly(holding => numericKey(holding.drift)),
      value: holding => holding.value === null ? null : holding.valueNum,
      unrealized: unlessCashOnly(holding => numericKey(holding.unrealized)),
      realized: holding => Number(holding.realized)
   }

   return (
      <Table className="tabular-nums">
         <TableHeader>
            <TableRow>
               <SortableHead column="asset" sort={sort} onSortChange={onSortChange}>Asset</SortableHead>
               <SortableHead column="target" align="right" sort={sort} onSortChange={onSortChange}>Target</SortableHead>
               <TableHead className="text-right">Stop</TableHead>
               <SortableHead column="weight" align="right" sort={sort} onSortChange={onSortChange}>Current</SortableHead>
               <SortableHead column="drift" align="right" sort={sort} onSortChange={onSortChange}>Drift</SortableHead>
               <TableHead className="text-right">Quantity</TableHead>
               <TableHead className="text-right">Price</TableHead>
               <SortableHead column="value" align="right" sort={sort} onSortChange={onSortChange}>Value</SortableHead>
               <SortableHead column="unrealized" align="right" sort={sort} onSortChange={onSortChange}>Unrealized</SortableHead>
               <SortableHead column="realized" align="right" sort={sort} onSortChange={onSortChange}>Realized</SortableHead>
            </TableRow>
         </TableHeader>
         <TableBody>
            {sortRows(portfolio.holdings, sort, sortKeys).map(holding => {
               const untargeted = Number(holding.target) === 0
               if (isCashOnly(holding)) {
                  const realizedShown = !showsAsZeroQuoteAmount(holding.realized)
                  if (showsAsZeroQuoteAmount(holding.quantity) && !realizedShown) return null
                  return (
                     <TableRow key={holding.asset}>
                        <TableCell className="font-medium">
                           {holding.asset}
                           <span className="ml-2 text-xs text-muted-foreground">cash</span>
                        </TableCell>
                        <TableCell colSpan={6} />
                        <TableCell className="text-right">{asQuoteAmount(holding.value, quote)}</TableCell>
                        <TableCell />
                        {realizedShown ? <ProfitCell value={holding.realized} quote={quote} /> : <TableCell />}
                     </TableRow>
                  )
               }
               const driftColor = holding.drift === null ? undefined : Math.abs(Number(holding.drift)) > band
                  ? 'text-destructive'
                  : 'text-emerald-600 dark:text-emerald-400'
               return (
                  <TableRow key={holding.asset}>
                     <TableCell className="font-medium">
                        {holding.asset}
                        {untargeted && <span className="ml-2 text-xs text-muted-foreground">not a target</span>}
                     </TableCell>
                     <TableCell className="text-right">{asWeight(holding.target)}</TableCell>
                     <StopCell holding={holding} />
                     <TableCell className="text-right">{asWeight(holding.weight)}</TableCell>
                     <TableCell className={cn('text-right', driftColor)}>
                        {asDrift(holding.drift)}
                     </TableCell>
                     <TableCell className={cn('text-right', Number(holding.quantity) < 0 && 'text-destructive')}>
                        {asQuantity(holding.quantity)}
                     </TableCell>
                     <TableCell className="text-right text-muted-foreground">
                        {holding.price === null ? 'no price' : asQuantity(holding.price)}
                     </TableCell>
                     <TableCell className="text-right">{asQuoteAmount(holding.value, quote)}</TableCell>
                     <ProfitCell value={holding.unrealized} percent={holding.unrealizedPercent} quote={quote} />
                     <ProfitCell value={holding.realized} quote={quote} />
                  </TableRow>
               )
            })}
            {!showsAsZeroQuoteAmount(portfolio.closedRealized) &&
               <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground">Closed positions</TableCell>
                  <ProfitCell value={portfolio.closedRealized} quote={quote} />
               </TableRow>}
         </TableBody>
         <TableFooter>
            <TableRow>
               <TableCell colSpan={7}>Total</TableCell>
               <TableCell className="text-right">{asQuoteAmount(portfolio.value, quote)}</TableCell>
               <ProfitCell value={portfolio.unrealized} percent={portfolio.unrealizedPercent} quote={quote} />
               <ProfitCell value={portfolio.realized} quote={quote} />
            </TableRow>
         </TableFooter>
      </Table>
   )
}
