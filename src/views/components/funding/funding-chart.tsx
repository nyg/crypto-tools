import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip } from '@/components/ui/chart'
import {
   asAssetAmount, asAxisTick, asUtcLongDate, asUtcMonthYearDate, asUtcShortDateYear, asUtcShortMonthYearDate
} from '../../../utils/format'
import type { ChartConfig } from '@/components/ui/chart'
import type { FundingBucket, FundingGranularity } from '@/lib/funding'

export type FundingChartView = 'movements' | 'net'

const DEPOSIT_COLOR = 'var(--chart-3)'
const WITHDRAWAL_COLOR = 'var(--chart-8)'

const movementsConfig: ChartConfig = {
   deposited: { label: 'Deposits', color: DEPOSIT_COLOR },
   withdrawn: { label: 'Withdrawals', color: WITHDRAWAL_COLOR }
}

const netConfig: ChartConfig = {
   net: { label: 'Net to date' }
}

const yearOf = (start: number) => String(new Date(start).getUTCFullYear())

const ticks: Record<FundingGranularity, (start: number) => string> = {
   day: asUtcShortDateYear, month: asUtcShortMonthYearDate, year: yearOf
}

const labels: Record<FundingGranularity, (start: number) => string> = {
   day: asUtcLongDate, month: asUtcMonthYearDate, year: yearOf
}

function TooltipRow({ color, label, value }: { color: string, label: string, value: number }) {
   return (
      <div className="flex items-center gap-2">
         <div className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
         <span className="flex-1 text-muted-foreground">{label}</span>
         <span className="pl-4 font-mono font-medium tabular-nums text-foreground">{asAssetAmount(value)}</span>
      </div>
   )
}

function FundingTooltip({ active, payload, granularity }: {
   active?: boolean
   payload?: { payload?: FundingBucket }[]
   granularity: FundingGranularity
}) {

   const bucket = payload?.[0]?.payload
   if (!active || !bucket) return null

   return (
      <div className="grid min-w-32 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
         <div className="font-medium">{labels[granularity](bucket.start)}</div>
         {bucket.deposited !== 0 && <TooltipRow color={DEPOSIT_COLOR} label="Deposits" value={bucket.deposited} />}
         {bucket.withdrawn !== 0 && <TooltipRow color={WITHDRAWAL_COLOR} label="Withdrawals" value={-bucket.withdrawn} />}
         <TooltipRow
            color={bucket.net < 0 ? WITHDRAWAL_COLOR : DEPOSIT_COLOR}
            label="Net to date"
            value={bucket.net} />
      </div>
   )
}

// The x axis is one category per bucket rather than a time scale: periods in which
// nothing moved take no room, however far apart their neighbours are.
export default function FundingChart({ buckets, granularity, view }: {
   buckets: FundingBucket[]
   granularity: FundingGranularity
   view: FundingChartView
}) {
   return (
      <ChartContainer config={view === 'net' ? netConfig : movementsConfig} className="h-[320px] w-full">
         <BarChart data={buckets} stackOffset="sign" margin={{ top: 8, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis
               dataKey="start"
               tickLine={false}
               axisLine={false}
               tickMargin={8}
               minTickGap={16}
               tickFormatter={ticks[granularity]} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} width={72} tickFormatter={asAxisTick} />
            <ReferenceLine y={0} stroke="var(--border)" />
            <ChartTooltip content={<FundingTooltip granularity={granularity} />} />
            {/* The entry animation is off for the same reason as the fee chart: under
                StrictMode the bars can stay stuck on their zero-height first frame. */}
            {view === 'net'
               ? <Bar dataKey="net" maxBarSize={48} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {buckets.map(bucket =>
                     <Cell key={bucket.start} fill={bucket.net < 0 ? WITHDRAWAL_COLOR : DEPOSIT_COLOR} />)}
               </Bar>
               : <>
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar
                     dataKey="deposited"
                     stackId="funding"
                     fill={DEPOSIT_COLOR}
                     maxBarSize={48}
                     radius={[4, 4, 0, 0]}
                     isAnimationActive={false} />
                  <Bar
                     dataKey="withdrawn"
                     stackId="funding"
                     fill={WITHDRAWAL_COLOR}
                     maxBarSize={48}
                     radius={[4, 4, 0, 0]}
                     isAnimationActive={false} />
               </>}
         </BarChart>
      </ChartContainer>
   )
}
