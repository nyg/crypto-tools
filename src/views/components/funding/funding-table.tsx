import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import AlignedDecimal from '../lib/aligned-decimal'
import SortableHead from '../lib/sortable-head'
import { asCount } from '../lib/filter-options'
import { fundingTotals } from '@/lib/funding'
import { numericKey, sortRows } from '@/lib/sort'
import { asNumericTimestamp, asUtcTimestamp, fractionDigits } from '../../../utils/format'
import type { SortKeys } from '@/lib/sort'
import type { FundingMovement } from '../../../types/api'
import type { FundingKind } from '../../../types/funding'
import type { Sort } from '../../../types/kraken'

const sortKeys: SortKeys<FundingMovement> = {
   time: movement => movement.time,
   method: movement => movement.method || null,
   amount: movement => numericKey(movement.amount),
   fee: movement => numericKey(movement.fee)
}

const COLLAPSED_ROWS = 10

const longestFraction = (values: string[]) => Math.max(0, ...values.map(fractionDigits))

const names: Record<FundingKind, { title: string, noun: string, total: 'deposited' | 'withdrawn' }> = {
   deposit: { title: 'Deposits', noun: 'deposit', total: 'deposited' },
   withdrawal: { title: 'Withdrawals', noun: 'withdrawal', total: 'withdrawn' }
}

export default function FundingTable({ kind, asset, movements }: {
   kind: FundingKind
   asset: string
   movements: FundingMovement[]
}) {

   const [sort, setSort] = useState<Sort>({ column: 'time', direction: 'desc' })
   const [expanded, setExpanded] = useState(false)

   const { title, noun, total } = names[kind]
   const sorted = sortRows(movements, sort, sortKeys)
   const rows = expanded ? sorted : sorted.slice(0, COLLAPSED_ROWS)
   const totals = fundingTotals(movements)
   const hasMethods = movements.some(({ method }) => method)
   const amountDigits = longestFraction([...movements.map(({ amount }) => amount), totals[total]])
   const feeDigits = longestFraction([...movements.map(({ fee }) => fee), totals.fees])

   const feeOf = (fee: string) => Number(fee) === 0 ? '—' : <AlignedDecimal value={fee} digits={feeDigits} />

   return (
      <div className="min-w-0 space-y-2">
         <div className="flex items-center justify-between gap-2">
            <h3 className="font-heading text-sm font-medium">{title}</h3>
            <Badge variant="outline">{asCount(movements.length, noun)}</Badge>
         </div>

         {movements.length === 0
            ? <p className="text-sm text-muted-foreground">No {noun} of {asset}.</p>
            : <Table className="tabular-nums">
               <TableHeader>
                  <TableRow>
                     <SortableHead column="time" sort={sort} onSortChange={setSort}>Date</SortableHead>
                     {hasMethods && <SortableHead column="method" sort={sort} onSortChange={setSort}>Via</SortableHead>}
                     <SortableHead column="amount" sort={sort} onSortChange={setSort} align="right">Amount</SortableHead>
                     <SortableHead column="fee" sort={sort} onSortChange={setSort} align="right">Fee</SortableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {rows.map(movement =>
                     <TableRow key={movement.id}>
                        <TableCell className="text-muted-foreground" title={`${asUtcTimestamp(movement.time)} UTC`}>
                           {asNumericTimestamp(movement.time)}
                           {movement.pending && <Badge variant="secondary" className="ml-2">Pending</Badge>}
                        </TableCell>
                        {hasMethods && <TableCell className="text-muted-foreground">{movement.method || '—'}</TableCell>}
                        <TableCell className="text-right font-medium">
                           <AlignedDecimal value={movement.amount} digits={amountDigits} />
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{feeOf(movement.fee)}</TableCell>
                     </TableRow>)}
               </TableBody>
               <TableFooter>
                  <TableRow>
                     <TableHead colSpan={hasMethods ? 2 : 1}>Total</TableHead>
                     <TableCell className="text-right">
                        <AlignedDecimal value={totals[total]} digits={amountDigits} />
                     </TableCell>
                     {/* The weight of the rows above: a bolder digit is wider, and the points would not line up. */}
                     <TableCell className="text-right font-normal">{feeOf(totals.fees)}</TableCell>
                  </TableRow>
               </TableFooter>
            </Table>}

         {movements.length > COLLAPSED_ROWS &&
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setExpanded(!expanded)}>
               {expanded ? 'Show fewer' : `Show all ${asCount(movements.length, noun)}`}
            </Button>}
      </div>
   )
}
