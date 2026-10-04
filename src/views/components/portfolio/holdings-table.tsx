import { cn } from '@/lib/utils'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
   asDrift, asQuantity, asQuoteAmount, asSignedPercent, asSignedQuoteAmount, asWeight, profitColor,
   showsAsZeroQuoteAmount, stopStatusLabels
} from './format'
import { SupertrendCell, SupertrendHead } from './supertrend-cell'
import SortableHead from '../lib/sortable-head'
import { numericKey, sortRows } from '../../lib/sort'
import type { SupertrendColumns } from './supertrend-cell'
import type { SortKeys } from '../../lib/sort'
import type { PortfolioHolding, PortfolioSummary } from '../../../types/api'
import type { Sort } from '../../../types/kraken'

const SUPERTREND_COLUMNS = 2

const ProfitCell = ({ value, percent = null, quote }: { value: string | null, percent?: string | null, quote: string }) =>
   <TableCell className={cn('text-right', profitColor(value))} title={asSignedQuoteAmount(value, quote)}>
      {asSignedQuoteAmount(value)}
      {percent !== null && value !== null && !showsAsZeroQuoteAmount(value) &&
         <span className="ml-1.5 text-xs">({asSignedPercent(percent)})</span>}
   </TableCell>

const ValueCell = ({ value, quote }: { value: string | null, quote: string }) =>
   <TableCell className="text-right" title={asQuoteAmount(value, quote)}>{asQuoteAmount(value)}</TableCell>

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
   supertrend?: SupertrendColumns
   sort: Sort
   onSortChange: (sort: Sort) => void
}

export default function HoldingsTable({ portfolio, supertrend, sort, onSortChange }: HoldingsTableProps) {

   const band = Number(portfolio.band)
   const quote = portfolio.quoteAsset
   const extraColumns = supertrend ? SUPERTREND_COLUMNS : 0

   const isCash = (holding: PortfolioHolding) => holding.asset === quote
   const isCashOnly = (holding: PortfolioHolding) => isCash(holding) && Number(holding.target) === 0

   const sortKeys: SortKeys<PortfolioHolding> = {
      asset: holding => holding.asset,
      target: holding => Number(holding.target),
      weight: holding => numericKey(holding.weight),
      drift: holding => numericKey(holding.drift),
      value: holding => holding.value === null ? null : holding.valueNum,
      unrealized: holding => numericKey(holding.unrealized),
      realized: holding => Number(holding.realized)
   }

   const coins = sortRows(portfolio.holdings.filter(holding => !isCash(holding)), sort, sortKeys)
   const rows = [...coins, ...portfolio.holdings.filter(isCash)]

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
               {supertrend && <>
                  <SupertrendHead timeframe="daily">Supertrend 1D</SupertrendHead>
                  <SupertrendHead timeframe="weekly">Supertrend 1W</SupertrendHead>
               </>}
               <SortableHead column="value" align="right" sort={sort} onSortChange={onSortChange}>
                  Value<span className="text-xs font-normal text-muted-foreground">{quote}</span>
               </SortableHead>
               <SortableHead column="unrealized" align="right" sort={sort} onSortChange={onSortChange}>Unrealized</SortableHead>
               <SortableHead column="realized" align="right" sort={sort} onSortChange={onSortChange}>Realized</SortableHead>
            </TableRow>
         </TableHeader>
         <TableBody>
            {rows.map(holding => {
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
                        <TableCell colSpan={6 + extraColumns} />
                        <ValueCell value={holding.value} quote={quote} />
                        <TableCell />
                        {realizedShown
                           ? <ProfitCell value={holding.realized} percent={holding.realizedPercent} quote={quote} />
                           : <TableCell />}
                     </TableRow>
                  )
               }
               const levels = supertrend?.levels?.[`${holding.asset}${quote}`]
               const levelsLoading = Boolean(supertrend?.loading) && holding.asset !== quote
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
                     {supertrend && <>
                        <SupertrendCell
                           level={levels?.daily} price={holding.price} loading={levelsLoading} timeframe="daily" />
                        <SupertrendCell
                           level={levels?.weekly} price={holding.price} loading={levelsLoading} timeframe="weekly" />
                     </>}
                     <ValueCell value={holding.value} quote={quote} />
                     <ProfitCell value={holding.unrealized} percent={holding.unrealizedPercent} quote={quote} />
                     <ProfitCell value={holding.realized} percent={holding.realizedPercent} quote={quote} />
                  </TableRow>
               )
            })}
            {!showsAsZeroQuoteAmount(portfolio.closedRealized) &&
               <TableRow>
                  <TableCell colSpan={9 + extraColumns} className="text-muted-foreground">Closed positions</TableCell>
                  <ProfitCell value={portfolio.closedRealized} percent={portfolio.closedRealizedPercent} quote={quote} />
               </TableRow>}
         </TableBody>
         <TableFooter>
            <TableRow>
               <TableCell colSpan={7 + extraColumns}>Total</TableCell>
               <ValueCell value={portfolio.value} quote={quote} />
               <ProfitCell value={portfolio.unrealized} percent={portfolio.unrealizedPercent} quote={quote} />
               <ProfitCell value={portfolio.realized} percent={portfolio.realizedPercent} quote={quote} />
            </TableRow>
         </TableFooter>
      </Table>
   )
}
