import { cn } from '@/lib/utils'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { asDrift, asQuantity, asQuoteAmount, asWeight } from './format'
import type { PortfolioSummary } from '../../../types/api'

export default function HoldingsTable({ portfolio }: { portfolio: PortfolioSummary }) {

   const band = Number(portfolio.band)

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
            </TableRow>
         </TableHeader>
         <TableBody>
            {portfolio.holdings.map(holding => {
               const driftColor = holding.drift === null ? undefined : Math.abs(Number(holding.drift)) > band
                  ? 'text-destructive'
                  : 'text-emerald-600 dark:text-emerald-400'
               const untargeted = Number(holding.target) === 0
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
                     <TableCell className="text-right">{asQuoteAmount(holding.value, portfolio.quoteAsset)}</TableCell>
                  </TableRow>
               )
            })}
         </TableBody>
         <TableFooter>
            <TableRow>
               <TableCell colSpan={6}>Total</TableCell>
               <TableCell className="text-right">{asQuoteAmount(portfolio.value, portfolio.quoteAsset)}</TableCell>
            </TableRow>
         </TableFooter>
      </Table>
   )
}
