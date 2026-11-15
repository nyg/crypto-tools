import { useState } from 'react'

import { Table, TableBody, TableCell,TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import type { AggregateBalanceResponse, AggregateBalanceRow } from '../../../types/api'
import type { Sort } from '../../../types/kraken'
import { asAssetAmount, asDollarAmount } from '../../../utils/format'
import type { SortKeys } from '../../lib/sort'
import { sortRows } from '../../lib/sort'
import SortableHead from '../lib/sortable-head'

// Amounts cross the wire as the decimal strings Big serializes to.
const asAmount = (value: string | undefined) => Number(value) ? asAssetAmount(Number(value)) : '—'

const sortKeys: SortKeys<AggregateBalanceRow> = {
   asset: row => row.asset,
   value: row => Number(row.fiatValue)
}

export default function CurrentPositions({ data }: { data: AggregateBalanceResponse }) {

   const [sort, setSort] = useState<Sort>({})

   const total = data.balance.reduce((sum, asset) => sum + Number(asset.fiatValue ?? 0), 0)

   return (
      <div className="overflow-x-auto">
         <Table>
            <TableHeader>
               <TableRow>
                  <SortableHead column="asset" sort={sort} onSortChange={setSort}>Asset</SortableHead>
                  <TableHead className="text-right">Spot</TableHead>
                  <TableHead className="text-right">Staking</TableHead>
                  <TableHead className="text-right">Locked</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <SortableHead column="value" align="right" sort={sort} onSortChange={setSort}>Value</SortableHead>
               </TableRow>
            </TableHeader>
            <TableBody>
               {sortRows(data.balance, sort, sortKeys).map(({ asset, free, locked, staking, total: assetTotal, fiatValue }) =>
                  <TableRow key={asset}>
                     <TableCell className="font-medium">{asset}</TableCell>
                     <TableCell className="text-right tabular-nums">{asAmount(free)}</TableCell>
                     <TableCell className="text-right tabular-nums">{asAmount(staking?.balance)}</TableCell>
                     <TableCell className="text-right tabular-nums">{asAmount(locked)}</TableCell>
                     <TableCell className="text-right tabular-nums">{asAmount(assetTotal)}</TableCell>
                     <TableCell className="text-right tabular-nums">{asDollarAmount(Number(fiatValue))}</TableCell>
                  </TableRow>
               )}
            </TableBody>
            <TableFooter>
               <TableRow>
                  <TableCell colSpan={5}>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{asDollarAmount(total)}</TableCell>
               </TableRow>
            </TableFooter>
         </Table>
      </div>
   )
}
