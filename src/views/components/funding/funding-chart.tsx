import { Bar, CartesianGrid, Cell, ComposedChart, ErrorBar, Line, ReferenceLine, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip } from '@/components/ui/chart'
import {
   asAssetAmount, asAxisTick, asLongDate, asMonthYearDate, asShortDateYear, asShortMonthYearDate
} from '../../../utils/format'
import type { ChartConfig } from '@/components/ui/chart'
import type { FundingBucket, FundingGranularity } from '@/lib/funding'

export type FundingChartView = 'movements' | 'net'

const DEPOSIT_COLOR = 'var(--chart-3)'
const WITHDRAWAL_COLOR = 'var(--chart-8)'
const BALANCE_COLOR = 'var(--chart-1)'

const configs: Record<FundingChartView, ChartConfig> = {
   movements: {
      deposited: { label: 'Deposits', color: DEPOSIT_COLOR },
      withdrawn: { label: 'Withdrawals', color: WITHDRAWAL_COLOR },
      balance: { label: 'Balance', color: BALANCE_COLOR }
   },
   net: {
      net: { label: 'Net to date', color: DEPOSIT_COLOR },
      balance: { label: 'Balance', color: BALANCE_COLOR }
   }
}

// An error bar is given as the distances below and above its point.
const withSpread = (bucket: FundingBucket) => ({
   ...bucket,
   balanceSpread: bucket.balance !== null && bucket.balanceRange
      ? [bucket.balance - bucket.balanceRange[0], bucket.balanceRange[1] - bucket.balance]
      : [0, 0]
})

const yearOf = (start: number) => String(new Date(start).getFullYear())

const ticks: Record<FundingGranularity, (start: number) => string> = {
   day: asShortDateYear, month: asShortMonthYearDate, year: yearOf
}

const labels: Record<FundingGranularity, (start: number) => string> = {
   day: asLongDate, month: asMonthYearDate, year: yearOf
}

function TooltipRow({ color, label, value }: { color: string, label: string, value: number | [number, number] }) {
   return (
      <div className="flex items-center gap-2">
         <div className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
         <span className="flex-1 text-muted-foreground">{label}</span>
         <span className="pl-4 font-mono font-medium tabular-nums text-foreground">
            {[value].flat().map(asAssetAmount).join(' – ')}
         </span>
      </div>
   )
}

function FundingTooltip({ active, payload, granularity, showBalance }: {
   active?: boolean
   payload?: { payload?: FundingBucket }[]
   granularity: FundingGranularity
   showBalance: boolean
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
         {showBalance && bucket.balance !== null &&
            <TooltipRow color={BALANCE_COLOR} label="Balance after" value={bucket.balance} />}
         {showBalance && bucket.balanceRange &&
            <TooltipRow color={BALANCE_COLOR} label="Low and high since the bar before" value={bucket.balanceRange} />}
      </div>
   )
}

// The x axis is one category per bucket rather than a time scale: periods in which
// nothing moved take no room, however far apart their neighbours are.
export default function FundingChart({ buckets, granularity, view, showBalance }: {
   buckets: FundingBucket[]
   granularity: FundingGranularity
   view: FundingChartView
   showBalance: boolean
}) {
   return (
      <ChartContainer config={configs[view]} className="h-[320px] w-full">
         <ComposedChart data={buckets.map(withSpread)} stackOffset="sign" margin={{ top: 8, right: 8 }}>
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
            <ChartTooltip content={<FundingTooltip granularity={granularity} showBalance={showBalance} />} />
            <ChartLegend itemSorter={null} content={<ChartLegendContent />} />
            {/* The entry animation is off for the same reason as the fee chart: under
                StrictMode the bars can stay stuck on their zero-height first frame. */}
            {view === 'net'
               ? <Bar dataKey="net" fill={DEPOSIT_COLOR} maxBarSize={48} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {buckets.map(bucket =>
                     <Cell key={bucket.start} fill={bucket.net < 0 ? WITHDRAWAL_COLOR : DEPOSIT_COLOR} />)}
               </Bar>
               : <>
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
            {/* The line only has a point where something moved. Trades in between take the
                balance well away from it, which the whisker on each point is there to show. */}
            {showBalance &&
               <Line
                  dataKey="balance"
                  type="linear"
                  stroke={BALANCE_COLOR}
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: BALANCE_COLOR }}
                  activeDot={{ r: 4 }}
                  connectNulls
                  isAnimationActive={false}>
                  <ErrorBar
                     dataKey="balanceSpread"
                     direction="y"
                     width={6}
                     stroke={BALANCE_COLOR}
                     strokeWidth={1.5}
                     strokeOpacity={0.55}
                     isAnimationActive={false} />
               </Line>}
         </ComposedChart>
      </ChartContainer>
   )
}
