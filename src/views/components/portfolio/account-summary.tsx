import { TriangleAlertIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import Checkbox from '../lib/checkbox'
import SortableHead from '../lib/sortable-head'
import usePersistentState from '../../lib/use-persistent-state'
import { sortRows } from '../../lib/sort'
import type { SortKeys } from '../../lib/sort'
import { asQuantity, asQuoteAmount } from './format'
import type { AccountCoin, PortfolioOverviewResponse } from '../../../types/api'
import type { Sort } from '../../../types/kraken'

const sortKeys: SortKeys<AccountCoin> = {
   asset: coin => coin.asset,
   value: coin => coin.value === null ? null : coin.valueNum
}

export default function AccountSummary({ overview, label }: { overview: PortfolioOverviewResponse, label: string }) {

   const [hideAllocated, setHideAllocated] = usePersistentState('bybit.portfolios.hideAllocated', true)
   const [sort, setSort] = usePersistentState<Sort>('portfolios.account.sort', { column: 'value', direction: 'desc' })

   const asset = overview.valuationAsset
   const coins = sortRows(hideAllocated
      ? overview.coins.filter(coin => Number(coin.unallocated) !== 0)
      : overview.coins, sort, sortKeys)

   return (
      <Card size="sm">
         <CardHeader>
            <CardTitle>{label} account</CardTitle>
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
                        <SortableHead column="asset" sort={sort} onSortChange={setSort}>Coin</SortableHead>
                        <TableHead className="text-right">Wallet</TableHead>
                        <TableHead className="text-right">In portfolios</TableHead>
                        <TableHead className="text-right">Unallocated</TableHead>
                        <SortableHead column="value" align="right" sort={sort} onSortChange={setSort}>
                           Unallocated value
                        </SortableHead>
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
