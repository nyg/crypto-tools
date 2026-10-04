import { useState } from 'react'
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { asAssetAmount, asDollarAmount, asUtcMonthYearDate } from '../../../utils/format'
import SortIcon from '../lib/sort-icon'
import { placementColor, placementDescription, placementLabel, placementOfLockType } from './placement'
import { ValuationTag, otherValuation, usdOf, valuationLabels } from './reward-valuation'
import type { ReactNode } from 'react'
import type { RewardAmount, RewardAsset, RewardStrategy, RewardSummary } from '../../../types/api'
import type { UsdRates } from '../../../types/kraken'
import type { Valuation } from './reward-valuation'

// A year, or the row total. Every column ranks by what it is worth, never by the
// amount: a number of PEPE and a number of BTC cannot be compared.
type RewardColumn = number | 'total'

interface RewardSort {
   column: RewardColumn
   direction: 'asc' | 'desc'
}

function SortableHead({ column, sort, onSortChange, children }: {
   column: RewardColumn
   sort: RewardSort
   onSortChange: (sort: RewardSort) => void
   children: ReactNode
}) {
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
export const RewardCell = ({ amount, rate, valuation }: {
   amount?: RewardAmount
   rate: number | null
   valuation: Valuation
}) => {

   if (amount === undefined) {
      return <TableCell className="text-right text-muted-foreground">—</TableCell>
   }

   const shown = usdOf(amount, rate, valuation)
   const other = otherValuation(valuation)
   const otherValue = usdOf(amount, rate, other)
   const partial = shown.value != null && shown.unvalued > 0

   const title = [
      otherValue.value == null
         ? null
         : `${otherValue.unvalued > 0 ? '≥ ' : ''}${asDollarAmount(otherValue.value)} ${valuationLabels[other]}`,
      partial ? `${asAssetAmount(shown.unvalued)} left out, with no USD rate for the day it was paid` : null
   ].filter(Boolean).join(' · ')

   return (
      <TableCell className="text-right" title={title || undefined}>
         <div className="font-medium">
            {shown.value == null
               ? '—'
               : <>{partial && <span className="text-muted-foreground">≥ </span>}{asDollarAmount(shown.value)}</>}
         </div>
         <div className="text-xs text-muted-foreground">{asAssetAmount(amount.amount)}</div>
      </TableCell>
   )
}

function periodOf({ active, first, last }: RewardStrategy): string {
   const [from, to] = [asUtcMonthYearDate(first), asUtcMonthYearDate(last)]
   if (active) return `since ${from}`
   return from === to ? from : `${from} – ${to}`
}

const inOrderOfFirstReward = (strategies: RewardStrategy[]) =>
   strategies.toSorted((a, b) => a.first - b.first)

// Same label and colour as the placement badges on the Balances page, so a strategy
// reads the same on both. One that has ended keeps its colour but loses the fill.
function StrategyBadge({ strategy }: { strategy: RewardStrategy }) {

   const key = placementOfLockType(strategy.lockType)
   const color = placementColor(key)

   return (
      <Badge
         variant="outline"
         className={cn('gap-1.5 font-normal', !strategy.active && 'border-dashed text-muted-foreground')}
         title={`${strategy.active ? 'Paying' : 'Paid'} ${periodOf(strategy)}. ${placementDescription(key)}`}>
         <span
            className={cn('size-2 shrink-0 rounded-[2px]', !strategy.active && 'border')}
            style={strategy.active ? { backgroundColor: color } : { borderColor: color }} />
         {placementLabel(key, strategy)}
      </Badge>
   )
}


export default function RewardTable({ rewards, rates, valuation }: {
   rewards?: RewardSummary
   rates?: UsdRates
   valuation: Valuation
}) {

   // Sorting is local: every row is already on the page, so re-ordering costs no
   // request and there is nothing to page through. Null until the header is clicked,
   // because the column it starts on is a function of the data, which arrives later.
   const [sort, setSort] = useState<RewardSort | null>(null)
   const [expanded, setExpanded] = useState(() => new Set<string>())

   const toggle = (asset: string) => setExpanded(current => {
      const next = new Set(current)
      if (!next.delete(asset)) next.add(asset)
      return next
   })

   const years = rewards?.years ?? []
   const assets = rewards?.assets ?? []

   if (assets.length === 0) {
      return (
         <Card>
            <CardHeader>
               <CardTitle>By year<ValuationTag valuation={valuation} /></CardTitle>
            </CardHeader>
            <CardContent>
               <p className="text-sm text-muted-foreground">
                  No staking or earn rewards in the stored ledger.
               </p>
            </CardContent>
         </Card>
      )
   }

   const rateFor = (asset: string) => rates?.[asset] ?? null

   // What is being earned right now is what the page is opened for, so the table starts
   // on this year. A ledger that stops short of it falls back to its most recent year.
   const currentYear = new Date().getUTCFullYear()
   const defaultColumn: RewardColumn = years.includes(currentYear) ? currentYear : (years.at(-1) ?? 'total')
   const activeSort: RewardSort = sort ?? { column: defaultColumn, direction: 'desc' }

   // Every column is ranked by what it is worth, never by the amount: a number of PEPE
   // and a number of BTC cannot be compared.
   const sortValue = (asset: RewardAsset) => usdOf(
      activeSort.column === 'total' ? asset.total : asset.byYear[activeSort.column],
      rateFor(asset.asset),
      valuation).value

   const rows = assets.toSorted((a, b) => {
      const [left, right] = [sortValue(a), sortValue(b)]
      if (left == null && right == null) return a.asset.localeCompare(b.asset)
      if (left == null) return 1
      if (right == null) return -1
      if (left === right) return a.asset.localeCompare(b.asset)
      return activeSort.direction === 'desc' ? right - left : left - right
   })

   // Totals are in USD only: adding an amount of DOT to an amount of PEPE means nothing.
   const totalFor = (amountOf: (asset: RewardAsset) => RewardAmount | undefined) => rows
      .map(asset => usdOf(amountOf(asset), rateFor(asset.asset), valuation).value ?? 0)
      .reduce((sum, value) => sum + value, 0)

   const unvaluedAssets = rows
      .filter(asset => usdOf(asset.total, rateFor(asset.asset), valuation).unvalued > 0)
      .map(asset => asset.asset)

   return (
      <Card>
         <CardHeader>
            <CardTitle>By year<ValuationTag valuation={valuation} /></CardTitle>
         </CardHeader>
         <CardContent className="space-y-3">
            <div className="overflow-x-auto">
               <Table className="tabular-nums">
                  <TableHeader>
                     <TableRow>
                        <TableHead>Asset</TableHead>
                        <TableHead>Strategies</TableHead>
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
                     {rows.map(asset => {

                        const strategies = inOrderOfFirstReward(asset.strategies)
                        const isExpandable = strategies.length > 1
                        const isExpanded = isExpandable && expanded.has(asset.asset)

                        return [
                           <TableRow key={asset.asset}>
                              <TableCell className="font-medium">
                                 {isExpandable
                                    ? <button
                                       type="button"
                                       className="inline-flex items-center gap-1 hover:text-foreground"
                                       aria-expanded={isExpanded}
                                       onClick={() => toggle(asset.asset)}>
                                       {isExpanded
                                          ? <ChevronDownIcon className="size-3.5" />
                                          : <ChevronRightIcon className="size-3.5" />}
                                       {asset.asset}
                                    </button>
                                    : <span className="pl-[1.125rem]">{asset.asset}</span>}
                              </TableCell>
                              <TableCell>
                                 <div className="flex flex-wrap gap-1">
                                    {strategies.map(strategy =>
                                       <StrategyBadge key={strategy.lockType} strategy={strategy} />)}
                                 </div>
                              </TableCell>
                              {years.map(year =>
                                 <RewardCell
                                    key={year}
                                    amount={asset.byYear[year]}
                                    rate={rateFor(asset.asset)}
                                    valuation={valuation} />)}
                              <RewardCell amount={asset.total} rate={rateFor(asset.asset)} valuation={valuation} />
                           </TableRow>,

                           ...(isExpanded ? strategies.map(strategy =>
                              <TableRow key={`${asset.asset} ${strategy.lockType}`} className="text-muted-foreground">
                                 <TableCell />
                                 <TableCell className="pl-6 text-xs">
                                    {placementLabel(placementOfLockType(strategy.lockType), strategy)}
                                    <span className="ml-2">{periodOf(strategy)}</span>
                                 </TableCell>
                                 {years.map(year =>
                                    <RewardCell
                                       key={year}
                                       amount={strategy.byYear[year]}
                                       rate={rateFor(asset.asset)}
                                       valuation={valuation} />)}
                                 <RewardCell amount={strategy.total} rate={rateFor(asset.asset)} valuation={valuation} />
                              </TableRow>) : [])
                        ]
                     })}
                  </TableBody>
                  <TableFooter>
                     <TableRow>
                        <TableCell colSpan={2}>Total</TableCell>
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

            {valuation === 'received'
               ? <p className="text-xs text-muted-foreground">
                  Each cell is what the rewards of that year were worth in USD <b>on the day each one
                  was paid</b>, with the amount paid out underneath: Kraken&apos;s daily average price
                  for the last two years, its weekly average before that, and the ECB reference rate
                  for fiat. Rewards with no USD price for their day are shown without a value and left
                  out of the totals.
               </p>
               : <p className="text-xs text-muted-foreground">
                  Each cell is what the rewards of that year are worth <b>today</b>, with the amount
                  paid out underneath. Every figure moves with the market, and none of them is a record
                  of income at the time. Assets Kraken has no USD pair for are shown without a value and
                  left out of the totals.
               </p>}

            <p className="text-xs text-muted-foreground">
               A strategy with a dashed badge has ended: its Earn wallet held nothing at the
               ledger&apos;s last entry, or, for Auto Earn, it had not paid for two weeks by then.
            </p>

            {valuation === 'received' && rewards?.ratesPending &&
               <p className="text-xs text-muted-foreground">
                  Fetching the USD rates of the days that do not have one yet…
               </p>}

            {valuation === 'received' && !rewards?.ratesPending && unvaluedAssets.length > 0 &&
               <p className="text-xs text-muted-foreground">
                  Some of the days {unvaluedAssets.join(', ')} paid out on have no USD rate: Kraken did
                  not quote the asset in USD yet, or the rate could not be fetched. The next ledger
                  sync tries again.
               </p>}
         </CardContent>
      </Card>
   )
}
