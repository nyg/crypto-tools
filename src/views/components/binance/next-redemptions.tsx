import { useState } from 'react'
import { asAssetAmount, asPercentage, asLongDate } from '../../../utils/format'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import SortableHead from '../lib/sortable-head'
import { sortRows } from '../../lib/sort'
import type { SortKeys } from '../../lib/sort'
import type { AggregateBalanceResponse, StakingPosition } from '../../../types/api'
import type { Sort } from '../../../types/kraken'

const sortKeys: SortKeys<StakingPosition> = {
   asset: position => position.asset,
   apy: position => Number(position.apy),
   endDate: position => position.endDate
}

export default function NextRedemptions({ data }: { data: AggregateBalanceResponse }) {

   const [sort, setSort] = useState<Sort>({ column: 'endDate', direction: 'asc' })

   const positions = sortRows(data.balance.flatMap(asset => asset.staking.positions), sort, sortKeys)

   if (positions.length === 0) {
      return <p className="text-sm text-muted-foreground">No staking positions are currently open.</p>
   }

   return (
      <div className="overflow-x-auto">
         <Table>
            <TableHeader>
               <TableRow>
                  <SortableHead column="asset" sort={sort} onSortChange={setSort}>Asset</SortableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <SortableHead column="apy" align="right" sort={sort} onSortChange={setSort}>APY</SortableHead>
                  <TableHead className="text-right">Progress</TableHead>
                  <SortableHead column="endDate" align="right" sort={sort} onSortChange={setSort}>
                     Redemption date
                  </SortableHead>
               </TableRow>
            </TableHeader>
            <TableBody>
               {positions.map(position =>
                  <TableRow key={position.id}>
                     <TableCell className="font-medium">{position.asset}</TableCell>
                     <TableCell className="text-right tabular-nums">{asAssetAmount(Number(position.amount))}</TableCell>
                     <TableCell className="text-right tabular-nums">{asPercentage(Number(position.apy))}</TableCell>
                     <TableCell className="text-right tabular-nums">
                        {position.accrualDays} of {position.duration} days
                     </TableCell>
                     <TableCell className="text-right tabular-nums">{asLongDate(position.endDate)}</TableCell>
                  </TableRow>
               )}
            </TableBody>
         </Table>
      </div>
   )
}
