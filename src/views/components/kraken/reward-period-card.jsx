import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableRow, TableCell } from '@/components/ui/table'
import SelectField from '../lib/select-field'
import usePersistentState from '../../lib/use-persistent-state'
import { RewardCell, valueOf } from './reward-table'
import { asDollarAmount, asUtcLongDate } from '../../../utils/format'

const periods = [
   { value: 'week', label: 'Weekly' },
   { value: 'month', label: 'Monthly' }
]

const titles = { week: 'Last week', month: 'Last month' }


export default function RewardPeriodCard({ rewards, rates }) {

   const [period, setPeriod] = usePersistentState('kraken.rewards.period', 'month')

   const selected = rewards?.periods?.[period] ?? null
   const rateFor = asset => rates?.[asset] ?? null

   const rows = (selected?.assets ?? []).toSorted((a, b) => {
      const [left, right] = [valueOf(a.total, rateFor(a.asset)), valueOf(b.total, rateFor(b.asset))]
      if (left == null && right == null) return a.asset.localeCompare(b.asset)
      if (left == null) return 1
      if (right == null) return -1
      if (left === right) return a.asset.localeCompare(b.asset)
      return right - left
   })

   const valued = rows.filter(row => rateFor(row.asset) != null)
   const total = valued.reduce((sum, row) => sum + valueOf(row.total, rateFor(row.asset)), 0)

   const range = selected
      ? `${asUtcLongDate(selected.from)} – ${asUtcLongDate(selected.to)}`
      : 'No period yet'

   return (
      <Card>
         <CardHeader>
            <CardTitle>{titles[period]}</CardTitle>
            <CardDescription className="text-xs">{range}</CardDescription>
            <CardAction>
               <SelectField
                  name="reward-period"
                  className="w-28"
                  value={period}
                  onValueChange={setPeriod}
                  options={periods} />
            </CardAction>
         </CardHeader>
         <CardContent>

            {rows.length === 0
               ? <p className="text-sm text-muted-foreground">
                  {selected
                     ? `No rewards paid between ${asUtcLongDate(selected.from)} and ${asUtcLongDate(selected.to)}.`
                     : 'No rewards to show. Sync your ledger on the Ledger tab first.'}
               </p>
               : <div className="space-y-3">
                  <div className="scroll-shadows max-h-[232px] overflow-y-auto pr-3">
                     <Table className="tabular-nums">
                        <TableBody>
                           {rows.map(row =>
                              <TableRow key={row.asset}>
                                 <TableCell className="font-medium">{row.asset}</TableCell>
                                 <RewardCell amount={row.total} rate={rateFor(row.asset)} />
                              </TableRow>)}
                        </TableBody>
                     </Table>
                  </div>
                  <div
                     className="flex items-center justify-between border-t border-border pt-3 pl-2 pr-5 text-sm tabular-nums"
                     title={valued.length < rows.length
                        ? `${rows.length - valued.length} asset(s) have no USD pair and are not counted`
                        : undefined}>
                     <span>Total</span>
                     <span className="font-medium">{asDollarAmount(total)}</span>
                  </div>
               </div>}

         </CardContent>
      </Card>
   )
}
