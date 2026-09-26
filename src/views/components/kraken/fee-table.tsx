import { useState } from 'react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { asAssetAmount, asNumber, asDollarAmount, asPercentage } from '../../../utils/format'
import SortableHead from '../lib/sortable-head'
import type { FeeSummary } from '../../../types/api'
import type { FeeAssetRow } from '../../../types/db'
import type { Sort } from '../../../types/kraken'

function compare(a: FeeAssetRow, b: FeeAssetRow, sort: Sort) {

   const factor = sort.direction === 'asc' ? 1 : -1

   if (sort.column === 'asset') return factor * a.asset.localeCompare(b.asset)

   const column = sort.column as 'total' | 'entries' | 'value'
   const [left, right] = [a[column], b[column]]
   if (left == null && right == null) return a.asset.localeCompare(b.asset)
   if (left == null) return 1
   if (right == null) return -1

   return factor * (left - right)
}


export default function FeeTable({ fees }: { fees?: FeeSummary }) {

   const [sort, setSort] = useState<Sort>({ column: 'value', direction: 'desc' })

   const assets = (fees?.assets ?? []).toSorted((a, b) => compare(a, b, sort))

   const totalValue = assets.reduce((sum, asset) => sum + (asset.value ?? 0), 0)

   const unvaluedAssets = assets.filter(asset => asset.unvalued > 0).map(asset => asset.asset)

   if (assets.length === 0) {
      return (
         <p className="text-sm text-muted-foreground">
            No fees in the stored ledger for these filters.
         </p>
      )
   }

   return (
      <div className="space-y-3">
         <div className="overflow-x-auto">
            <Table className="tabular-nums">
               <TableHeader>
                  <TableRow>
                     <SortableHead column="asset" sort={sort} onSortChange={setSort}>Asset</SortableHead>
                     <SortableHead column="entries" sort={sort} onSortChange={setSort} align="right">Fees</SortableHead>
                     <SortableHead column="total" sort={sort} onSortChange={setSort} align="right">Total fees</SortableHead>
                     <SortableHead column="value" sort={sort} onSortChange={setSort} align="right">
                        <span title="At the USD rate of the day each fee was charged">Cost (USD)</span>
                     </SortableHead>
                     <TableHead className="text-right">Share</TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {assets.map(asset =>
                     <TableRow key={asset.asset}>
                        <TableCell className="font-medium">{asset.asset}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                           {asNumber(asset.entries)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                           {asAssetAmount(asset.total)}
                        </TableCell>
                        <TableCell
                           className="text-right font-medium"
                           title={asset.value != null && asset.unvalued > 0
                              ? `${asAssetAmount(asset.unvalued)} ${asset.asset} left out, with no USD rate for the day it was charged`
                              : undefined}>
                           {asset.value == null
                              ? '—'
                              : <>{asset.unvalued > 0 && <span className="text-muted-foreground">≥ </span>}{asDollarAmount(asset.value)}</>}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                           {asset.value == null || totalValue === 0
                              ? '—'
                              : asPercentage(asset.value / totalValue)}
                        </TableCell>
                     </TableRow>)}
               </TableBody>
            </Table>
         </div>

         <p className="text-xs text-muted-foreground">
            Each fee is valued in USD <b>on the day it was charged</b>: Kraken&apos;s daily average price
            for the last two years, its weekly average before that, and the ECB reference rate for
            fiat. Fees with no USD price for their day are shown without a value and left out of the
            share.
            {unvaluedAssets.length > 0 &&
               <> No USD rate is stored for some of the days {unvaluedAssets.join(', ')} was charged on;
                  a sync of the ledger fetches the rates it does not have yet.</>}
         </p>
      </div>
   )
}
