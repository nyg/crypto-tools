import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import ComboboxField from '../lib/combobox-field'
import SelectField from '../lib/select-field'
import usePersistentState from '../../lib/use-persistent-state'
import { ValuationTag, usdOf } from './reward-valuation'
import {
   asAssetAmount, asCompact, asDollarAmount, asRounded,
   asUtcLongDate, asUtcMonthYearDate, asUtcShortDate, asUtcShortMonthYearDate
} from '../../../utils/format'
import type { RewardAmount, RewardAsset, RewardSummary } from '../../../types/api'
import type { UsdRates } from '../../../types/kraken'
import type { Valuation } from './reward-valuation'

const EVERYTHING = 'ALL'

type Granularity = 'year' | 'month' | 'week'

interface Series {
   buckets: number[]
   amountOf: (asset: RewardAsset, bucket: number) => RewardAmount | undefined
   tick: (bucket: number) => string
   label: (bucket: number) => string
}

const granularities = [
   { value: 'year', label: 'Yearly' },
   { value: 'month', label: 'Monthly' },
   { value: 'week', label: 'Weekly' }
]

// Ticks stay short where the values do not: a dollar total wants no decimals, an
// amount of BTC still has to show that it is not zero.
const asAxisTick = (value: number) => {
   const magnitude = Math.abs(value)
   if (magnitude === 0) return '0'
   if (magnitude >= 1000) return asCompact(value)
   if (magnitude >= 1) return asRounded(value)
   return Number(value.toPrecision(2)).toString()
}

function seriesOf(rewards: RewardSummary | undefined, granularity: Granularity): Series {

   if (granularity === 'week') {
      return {
         buckets: rewards?.weeks ?? [],
         amountOf: (asset, bucket) => asset.byWeek[bucket],
         tick: asUtcShortDate,
         label: bucket => `Week of ${asUtcLongDate(bucket)}`
      }
   }

   if (granularity === 'month') {
      return {
         buckets: rewards?.months ?? [],
         amountOf: (asset, bucket) => asset.byMonth[bucket],
         tick: asUtcShortMonthYearDate,
         label: asUtcMonthYearDate
      }
   }

   return {
      buckets: rewards?.years ?? [],
      amountOf: (asset, bucket) => asset.byYear[bucket],
      tick: String,
      label: String
   }
}


export default function RewardHistoryCard({ rewards, rates, valuation }: {
   rewards?: RewardSummary
   rates?: UsdRates
   valuation: Valuation
}) {

   const [asset, setAsset] = useState(EVERYTHING)
   const [granularity, setGranularity] = usePersistentState<Granularity>('kraken.rewards.granularity', 'year')

   const assets = rewards?.assets ?? []
   const series = seriesOf(rewards, granularity)

   // Falls back to the total whenever the chosen asset is not in the data, so the card
   // never goes blank on a re-sync that dropped it.
   const selected = assets.find(row => row.asset === asset)
   const isTotal = asset === EVERYTHING || !selected

   // Every asset on one axis only works in a common unit, so the total is in USD and a
   // single asset is charted in its own amount — mixing them would make both unreadable.
   const data = series.buckets.map(bucket => ({
      bucket,
      value: isTotal
         ? assets.reduce((sum, row) =>
            sum + (usdOf(series.amountOf(row, bucket), rates?.[row.asset], valuation).value ?? 0), 0)
         : series.amountOf(selected!, bucket)?.amount ?? 0
   }))

   const format = (value: number) => isTotal ? asDollarAmount(value) : `${asAssetAmount(value)} ${asset}`

   const options = [
      { value: EVERYTHING, label: 'All assets (USD)' },
      ...assets.map(row => ({ value: row.asset, label: row.asset }))
   ]

   return (
      <Card>
         <CardHeader>
            <CardTitle>Over time{isTotal && <ValuationTag valuation={valuation} />}</CardTitle>
            <CardAction className="flex flex-col gap-2 @lg/card-header:flex-row">
               <SelectField
                  name="reward-history-granularity"
                  className="w-44"
                  value={granularity}
                  onValueChange={value => setGranularity(value as Granularity)}
                  options={granularities} />
               {/* Searchable: an account can hold dozens of rewarded assets, and
                   scrolling a plain select past them is slower than typing three letters. */}
               <ComboboxField
                  name="reward-history-asset"
                  className="w-44"
                  value={isTotal ? EVERYTHING : asset}
                  onValueChange={setAsset}
                  options={options}
                  searchPlaceholder="Search assets…"
                  emptyText="No asset found."
                  disabled={assets.length === 0} />
            </CardAction>
         </CardHeader>
         <CardContent>

            {assets.length === 0 || data.length === 0
               ? <p className="text-sm text-muted-foreground">
                  No rewards to chart. Sync your ledger on the Ledger tab first.
               </p>
               : <ChartContainer
                  config={{ value: { label: 'Rewards', color: 'var(--chart-1)' } }}
                  className="h-[260px] w-full">
                  <BarChart data={data} margin={{ top: 8, right: 8 }}>
                     <CartesianGrid vertical={false} />
                     <XAxis
                        dataKey="bucket"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        minTickGap={16}
                        tickFormatter={series.tick} />
                     <YAxis tickLine={false} axisLine={false} tickMargin={8} width={64} tickFormatter={asAxisTick} />
                     <ChartTooltip content={
                        <ChartTooltipContent
                           hideIndicator
                           labelFormatter={(_, payload) => {
                              const bucket = payload?.[0]?.payload?.bucket
                              return typeof bucket === 'number' ? series.label(bucket) : ''
                           }}
                           formatter={(value) =>
                              <span className="font-mono font-medium tabular-nums text-foreground">
                                 {format(Number(value))}
                              </span>} />} />
                     {/* Animation is off for the same reason as the fee chart: under
                         StrictMode the bars can stay stuck on their zero-height frame. */}
                     <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
               </ChartContainer>}

         </CardContent>
      </Card>
   )
}
