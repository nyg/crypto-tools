import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { asAssetAmount, asNumber, asDollarAmount, asPercentage } from '../../../utils/format'
import SortIcon from '../lib/sort-icon'

const valueOf = (total, rate) => rate == null ? null : total * rate

function SortableHead({ column, sort, onSortChange, align, children }) {
   const isActive = sort.column === column
   return (
      <TableHead className={align === 'right' ? 'text-right' : undefined}>
         <button
            type="button"
            className={cn('inline-flex w-full items-center gap-1 hover:text-foreground',
               align === 'right' && 'justify-end',
               isActive && 'font-semibold text-foreground')}
            onClick={() => onSortChange({
               column,
               direction: isActive && sort.direction === 'desc' ? 'asc' : 'desc'
            })}>
            {children}
            <SortIcon isActive={isActive} direction={sort.direction} />
         </button>
      </TableHead>
   )
}

function compare(a, b, sort) {

   const factor = sort.direction === 'asc' ? 1 : -1

   if (sort.column === 'asset') return factor * a.asset.localeCompare(b.asset)

   const [left, right] = [a[sort.column], b[sort.column]]
   if (left == null && right == null) return a.asset.localeCompare(b.asset)
   if (left == null) return 1
   if (right == null) return -1

   return factor * (left - right)
}


export default function FeeTable({ fees, rates }) {

   const [sort, setSort] = useState({ column: 'value', direction: 'desc' })

   const assets = (fees?.assets ?? [])
      .map(asset => ({ ...asset, value: valueOf(asset.total, rates?.[asset.asset]) }))
      .toSorted((a, b) => compare(a, b, sort))

   const totalValue = assets.reduce((sum, asset) => sum + (asset.value ?? 0), 0)

   if (assets.length === 0) {
      return (
         <p className="text-sm text-muted-foreground">
            No fees in the stored ledger for these filters.
         </p>
      )
   }

   return (
      <div className="overflow-x-auto">
         <Table className="tabular-nums">
            <TableHeader>
               <TableRow>
                  <SortableHead column="asset" sort={sort} onSortChange={setSort}>Asset</SortableHead>
                  <SortableHead column="entries" sort={sort} onSortChange={setSort} align="right">Fees</SortableHead>
                  <SortableHead column="total" sort={sort} onSortChange={setSort} align="right">Total fees</SortableHead>
                  <SortableHead column="value" sort={sort} onSortChange={setSort} align="right">Total fees (USD)</SortableHead>
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
                     <TableCell className="text-right font-medium">
                        {asset.value == null ? '—' : asDollarAmount(asset.value)}
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
   )
}
