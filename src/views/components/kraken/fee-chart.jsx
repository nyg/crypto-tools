import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
   ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent
} from '@/components/ui/chart'
import SelectField from '../lib/select-field'
import ComboboxField from '../lib/combobox-field'
import { asAssetAmount, asCompact, asRounded, asShortMonthYearDate } from '../../../utils/format'

const granularities = [
   { value: 'month', label: 'Month' },
   { value: 'quarter', label: 'Quarter' },
   { value: 'year', label: 'Year' }
]

// Axis ticks have to stay short where the values do not: a fiat total wants no
// decimals, a BTC one still has to show that it is not zero.
const asAxisTick = (value) => {
   const magnitude = Math.abs(value)
   if (magnitude === 0) return '0'
   if (magnitude >= 1000) return asCompact(value)
   if (magnitude >= 1) return asRounded(value)
   return Number(value.toPrecision(2)).toString()
}

// The server buckets by month; anything coarser is folded from those here.
const bucketOf = (month, granularity) => {

   const [year, index] = month.split('-').map(Number)

   if (granularity === 'year') return { key: `${year}`, label: `${year}` }

   if (granularity === 'quarter') {
      const quarter = Math.floor((index - 1) / 3) + 1
      return { key: `${year}-Q${quarter}`, label: `Q${quarter} ${String(year).slice(2)}` }
   }

   return { key: month, label: asShortMonthYearDate(Date.UTC(year, index - 1, 1)) }
}

// Months with no fee produce no row, so the buckets are walked from the first to the
// last rather than taken from the data — otherwise a quiet year would be squeezed out
// of the axis and the bars either side would read as consecutive.
function bucketsBetween(firstMonth, lastMonth, granularity) {

   const [lastYear, lastIndex] = lastMonth.split('-').map(Number)
   const buckets = []
   let [year, index] = firstMonth.split('-').map(Number)

   while (year < lastYear || (year === lastYear && index <= lastIndex)) {

      const bucket = bucketOf(`${year}-${String(index).padStart(2, '0')}`, granularity)
      if (buckets.at(-1)?.key !== bucket.key) buckets.push(bucket)

      index += 1
      if (index > 12) {
         index = 1
         year += 1
      }
   }

   return buckets
}

function buildChart(byMonth, asset, granularity) {

   const rows = byMonth.filter(row => row.asset === asset)
   if (rows.length === 0) return { data: [], types: [] }

   const totals = new Map()
   for (const row of rows) totals.set(row.type, (totals.get(row.type) ?? 0) + row.total)

   // The biggest contributor sits at the bottom of the stack. This is the drawing
   // order only — colours come from the ledger's full type list, so re-ordering here
   // never repaints a series.
   const types = [...totals.keys()].toSorted((a, b) => totals.get(b) - totals.get(a))

   const months = [...new Set(rows.map(row => row.month))].toSorted()

   // Every series gets a value in every bucket, including zero. A stacked bar chart
   // needs the full set: leaving a key out makes the offsets of the segments above it
   // in that bucket come out as NaN, and the whole stack then draws nothing.
   const buckets = new Map(bucketsBetween(months[0], months.at(-1), granularity)
      .map(bucket => [bucket.key, { period: bucket.label, ...Object.fromEntries(types.map(type => [type, 0])) }]))

   for (const row of rows) {
      buckets.get(bucketOf(row.month, granularity).key)[row.type] += row.total
   }

   return { data: [...buckets.values()], types }
}


export default function FeeChart({ fees, colors, assets, asset, granularity, onAssetChange, onGranularityChange }) {

   const { data, types } = buildChart(fees?.byMonth ?? [], asset, granularity)

   const config = Object.fromEntries(types.map(type =>
      [type, { label: type, color: colors.get(type) }]))

   return (
      <div className="space-y-4">

         <div className="flex flex-wrap gap-4">
            <ComboboxField
               name="fee-chart-asset"
               label="Chart asset"
               className="w-40"
               value={asset ?? ''}
               onValueChange={onAssetChange}
               options={assets.map(value => ({ value, label: value }))}
               searchPlaceholder="Search assets…"
               emptyText="No asset."
               disabled={assets.length === 0} />
            <SelectField
               name="fee-chart-granularity"
               label="Group by"
               className="w-40"
               value={granularity}
               onValueChange={onGranularityChange}
               options={granularities} />
         </div>

         {data.length === 0
            ? <p className="text-sm text-muted-foreground">
               No fees to chart. Sync your ledger on the Ledger tab, or widen the filters.
            </p>
            : <ChartContainer config={config} className="h-[320px] w-full">
               <BarChart data={data} margin={{ top: 8, right: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="period" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} width={72} tickFormatter={asAxisTick} />
                  <ChartTooltip content={
                     <ChartTooltipContent
                        formatter={(value, name) =>
                           <>
                              <div
                                 className="size-2.5 shrink-0 rounded-[2px]"
                                 style={{ backgroundColor: colors.get(name) }} />
                              <div className="flex flex-1 items-center justify-between gap-4 leading-none">
                                 <span className="text-muted-foreground">{name}</span>
                                 <span className="font-mono font-medium tabular-nums text-foreground">
                                    {asAssetAmount(value)}
                                 </span>
                              </div>
                           </>} />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  {/* The entry animation is off on purpose: under StrictMode its effect is
                      mounted, torn down and remounted, and the bars can stay stuck on the
                      zero-height first frame, which renders no rectangles at all. */}
                  {types.map((type, index) =>
                     <Bar
                        key={type}
                        dataKey={type}
                        stackId="fee"
                        fill={colors.get(type)}
                        stroke="var(--card)"
                        strokeWidth={2}
                        isAnimationActive={false}
                        radius={index === types.length - 1 ? [4, 4, 0, 0] : 0} />)}
               </BarChart>
            </ChartContainer>}

      </div>
   )
}
