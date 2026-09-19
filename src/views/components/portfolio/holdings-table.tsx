import { cn } from '@/lib/utils'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
   asDrift, asQuantity, asQuoteAmount, asSignedQuoteAmount, asWeight, profitColor, showsAsZeroQuoteAmount
} from './format'
import type { PortfolioSummary } from '../../../types/api'

const ProfitCell = ({ value, quote }: { value: string | null, quote: string }) =>
   <TableCell className={cn('text-right', profitColor(value))}>{asSignedQuoteAmount(value, quote)}</TableCell>

export default function HoldingsTable({ portfolio }: { portfolio: PortfolioSummary }) {

   const band = Number(portfolio.band)
   const quote = portfolio.quoteAsset

   return (
      <Table className="tabular-nums">
         <TableHeader>
            <TableRow>
               <TableHead>Asset</TableHead>
               <TableHead className="text-right">Target</TableHead>
               <TableHead className="text-right">Current</TableHead>
               <TableHead className="text-right">Drift</TableHead>
               <TableHead className="text-right">Quantity</TableHead>
               <TableHead className="text-right">Price</TableHead>
               <TableHead className="text-right">Value</TableHead>
               <TableHead className="text-right">Unrealized</TableHead>
               <TableHead className="text-right">Realized</TableHead>
            </TableRow>
         </TableHeader>
         <TableBody>
            {portfolio.holdings.map(holding => {
               const untargeted = Number(holding.target) === 0
               if (untargeted && holding.asset === quote) {
                  const realizedShown = !showsAsZeroQuoteAmount(holding.realized)
                  if (showsAsZeroQuoteAmount(holding.quantity) && !realizedShown) return null
                  return (
                     <TableRow key={holding.asset}>
                        <TableCell className="font-medium">
                           {holding.asset}
                           <span className="ml-2 text-xs text-muted-foreground">cash</span>
                        </TableCell>
                        <TableCell colSpan={5} />
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
                     <ProfitCell value={holding.unrealized} quote={quote} />
                     <ProfitCell value={holding.realized} quote={quote} />
                  </TableRow>
               )
            })}
            {!showsAsZeroQuoteAmount(portfolio.closedRealized) &&
               <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground">Closed positions</TableCell>
                  <ProfitCell value={portfolio.closedRealized} quote={quote} />
               </TableRow>}
         </TableBody>
         <TableFooter>
            <TableRow>
               <TableCell colSpan={6}>Total</TableCell>
               <TableCell className="text-right">{asQuoteAmount(portfolio.value, quote)}</TableCell>
               <ProfitCell value={portfolio.unrealized} quote={quote} />
               <ProfitCell value={portfolio.realized} quote={quote} />
            </TableRow>
         </TableFooter>
      </Table>
   )
}
