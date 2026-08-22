import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { asAssetAmount, asDollarAmount } from '../../../utils/format'
import SortIcon from '../lib/sort-icon'

// An asset Kraken has no USD pair for has no rate at all, which is not the same as
// being worth nothing: it is left out of the totals, shown as a dash, and sorted last
// whichever column is sorted on.
export const valueOf = (amount, rate) => rate == null ? null : (amount ?? 0) * rate

function SortableHead({ column, sort, onSortChange, children }) {
   const isActive = sort.column === column
   return (
      <TableHead className="text-right">
         <button
            type="button"
            title="Sort by value in USD"
            className={cn('ml-auto inline-flex items-center gap-1 hover:text-foreground',
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

// The value is what the column is read for, so it leads; the amount actually paid out
// sits underneath it.
export const RewardCell = ({ amount, rate }) => {

   if (amount === undefined) {
      return <TableCell className="text-right text-muted-foreground">—</TableCell>
   }

   const value = valueOf(amount, rate)

   return (
      <TableCell className="text-right">
         <div className="font-medium">{value == null ? '—' : asDollarAmount(value)}</div>
         <div className="text-xs text-muted-foreground">{asAssetAmount(amount)}</div>
      </TableCell>
   )
}


export default function RewardTable({ rewards, rates }) {

   // Sorting is local: every row is already on the page, so re-ordering costs no
   // request and there is nothing to page through. Null until the header is clicked,
   // because the column it starts on is a function of the data, which arrives later.
   const [sort, setSort] = useState(null)

   const years = rewards?.years ?? []
   const assets = rewards?.assets ?? []

   if (assets.length === 0) {
      return (
         <Card>
            <CardHeader>
               <CardTitle>By year</CardTitle>
            </CardHeader>
            <CardContent>
               <p className="text-sm text-muted-foreground">
                  No staking or earn rewards in the stored ledger.
               </p>
            </CardContent>
         </Card>
      )
   }

   const rateFor = asset => rates?.[asset] ?? null

   // What is being earned right now is what the page is opened for, so the table starts
   // on this year. A ledger that stops short of it falls back to its most recent year.
   const currentYear = new Date().getUTCFullYear()
   const defaultColumn = years.includes(currentYear) ? currentYear : (years.at(-1) ?? 'total')
   const activeSort = sort ?? { column: defaultColumn, direction: 'desc' }

   // Every column is ranked by what it is worth, never by the amount: a number of PEPE
   // and a number of BTC cannot be compared.
   const sortValue = asset => activeSort.column === 'total'
      ? valueOf(asset.total, rateFor(asset.asset))
      : valueOf(asset.byYear[activeSort.column], rateFor(asset.asset))

   const rows = assets.toSorted((a, b) => {
      const [left, right] = [sortValue(a), sortValue(b)]
      if (left == null && right == null) return a.asset.localeCompare(b.asset)
      if (left == null) return 1
      if (right == null) return -1
      if (left === right) return a.asset.localeCompare(b.asset)
      return activeSort.direction === 'desc' ? right - left : left - right
   })

   // Totals are in USD only: adding an amount of DOT to an amount of PEPE means nothing.
   const totalFor = amountOf => rows
      .map(asset => valueOf(amountOf(asset), rateFor(asset.asset)) ?? 0)
      .reduce((sum, value) => sum + value, 0)

   return (
      <Card>
         <CardHeader>
            <CardTitle>By year</CardTitle>
         </CardHeader>
         <CardContent className="space-y-3">
            <div className="overflow-x-auto">
               <Table className="tabular-nums">
                  <TableHeader>
                     <TableRow>
                        <TableHead>Asset</TableHead>
                        {years.map(year =>
                           <SortableHead key={year} column={year} sort={activeSort} onSortChange={setSort}>
                              {year}
                           </SortableHead>)}
                        <SortableHead column="total" sort={activeSort} onSortChange={setSort}>
                           Total
                        </SortableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {rows.map(asset =>
                        <TableRow key={asset.asset}>
                           <TableCell className="font-medium">{asset.asset}</TableCell>
                           {years.map(year =>
                              <RewardCell
                                 key={year}
                                 amount={asset.byYear[year]}
                                 rate={rateFor(asset.asset)} />)}
                           <RewardCell amount={asset.total} rate={rateFor(asset.asset)} />
                        </TableRow>)}
                  </TableBody>
                  <TableFooter>
                     <TableRow>
                        <TableCell>Total</TableCell>
                        {years.map(year =>
                           <TableCell key={year} className="text-right">
                              {asDollarAmount(totalFor(asset => asset.byYear[year]))}
                           </TableCell>)}
                        <TableCell className="text-right">
                           {asDollarAmount(totalFor(asset => asset.total))}
                        </TableCell>
                     </TableRow>
                  </TableFooter>
               </Table>
            </div>

            <p className="text-xs text-muted-foreground">
               Each cell is what the rewards of that year are worth <b>today</b>, with the amount
               that was actually paid out underneath. Nothing is valued at the price of the day it
               was received, so every figure moves with the market and none of them is a record of
               income at the time. Assets Kraken has no USD pair for are shown without a value and
               left out of the totals.
            </p>
         </CardContent>
      </Card>
   )
}
