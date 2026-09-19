import { TriangleAlertIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import Checkbox from '../lib/checkbox'
import usePersistentState from '../../lib/use-persistent-state'
import { asQuantity, asQuoteAmount } from './format'
import type { PortfolioOverviewResponse } from '../../../types/api'

export default function AccountSummary({ overview, label }: { overview: PortfolioOverviewResponse, label: string }) {

   const [hideAllocated, setHideAllocated] = usePersistentState('bybit.portfolios.hideAllocated', false)

   const asset = overview.valuationAsset
   const allocated = Number(overview.totalValue) - Number(overview.unallocatedValue)
   const coins = hideAllocated
      ? overview.coins.filter(coin => Number(coin.unallocated) !== 0)
      : overview.coins

   return (
      <Card size="sm">
         <CardHeader>
            <CardTitle>{label} account</CardTitle>
            <CardDescription>
               {asQuoteAmount(overview.totalValue, asset)} in the unified trading account ·{' '}
               {asQuoteAmount(String(allocated), asset)} in portfolios ·{' '}
               {asQuoteAmount(overview.unallocatedValue, asset)} unallocated
            </CardDescription>
            <CardAction>
               <Checkbox
                  name="portfolio-hide-allocated"
                  checked={hideAllocated}
                  onChange={event => setHideAllocated(event.target.checked)}
                  label="Hide coins fully held by portfolios" />
            </CardAction>
         </CardHeader>
         <CardContent>
            {coins.length === 0
               ? <p className="text-sm text-muted-foreground">Every coin in the account is held by a portfolio.</p>
               : <Table className="tabular-nums">
                  <TableHeader>
                     <TableRow>
                        <TableHead>Coin</TableHead>
                        <TableHead className="text-right">Wallet</TableHead>
                        <TableHead className="text-right">In portfolios</TableHead>
                        <TableHead className="text-right">Unallocated</TableHead>
                        <TableHead className="text-right">Unallocated value</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {coins.map(coin =>
                        <TableRow key={coin.asset}>
                           <TableCell className="font-medium">{coin.asset}</TableCell>
                           <TableCell className="text-right">{asQuantity(coin.wallet)}</TableCell>
                           <TableCell className="text-right">{asQuantity(coin.allocated)}</TableCell>
                           <TableCell className={cn('text-right', coin.overallocated && 'text-destructive')}>
                              {coin.overallocated &&
                                 <TriangleAlertIcon className="mr-1 inline size-3.5 align-[-2px]" aria-label="Over-allocated" />}
                              {asQuantity(coin.unallocated)}
                           </TableCell>
                           <TableCell className="text-right text-muted-foreground">{asQuoteAmount(coin.value, asset)}</TableCell>
                        </TableRow>)}
                  </TableBody>
               </Table>}
         </CardContent>
      </Card>
   )
}
