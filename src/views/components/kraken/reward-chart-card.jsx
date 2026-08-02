import { Cell, Pie, PieChart } from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import { asAssetAmount, asDollarAmount, asPercentage } from '../../../utils/format'

// Past this many slices the chart stops saying anything: the tail is folded into one
// "Others" slice, which the table above still breaks down asset by asset.
const MAX_SLICES = 8
const OTHERS = 'Others'

function buildSlices(assets, rates) {

   const valued = assets
      .filter(asset => rates?.[asset.asset] != null)
      .map(asset => ({
         asset: asset.asset,
         value: asset.total * rates[asset.asset],
         amount: asset.total
      }))
      // A reward can be negative in principle; a negative slice cannot be drawn.
      .filter(slice => slice.value > 0)
      .toSorted((a, b) => b.value - a.value)

   if (valued.length <= MAX_SLICES) return valued

   const others = valued.slice(MAX_SLICES - 1)

   return [
      ...valued.slice(0, MAX_SLICES - 1),
      {
         asset: OTHERS,
         value: others.reduce((sum, slice) => sum + slice.value, 0),
         assets: others.length
      }
   ]
}


export default function RewardChartCard({ rewards, rates }) {

   const slices = buildSlices(rewards?.assets ?? [], rates)
   const total = slices.reduce((sum, slice) => sum + slice.value, 0)

   const colors = new Map(slices.map((slice, index) =>
      [slice.asset, slice.asset === OTHERS ? 'var(--muted-foreground)' : `var(--chart-${(index % 8) + 1})`]))

   const config = Object.fromEntries(slices.map(slice =>
      [slice.asset, { label: slice.asset, color: colors.get(slice.asset) }]))

   return (
      <Card>
         <CardHeader>
            <CardTitle>Share of rewards</CardTitle>
         </CardHeader>
         <CardContent className="space-y-3">

            {slices.length === 0
               ? <p className="text-sm text-muted-foreground">
                  Nothing to chart: none of the rewarded assets could be valued in USD.
               </p>
               : <ChartContainer config={config} className="h-[320px] w-full">
                  <PieChart>
                     <ChartTooltip content={
                        <ChartTooltipContent
                           hideLabel
                           nameKey="asset"
                           formatter={(value, name, item) =>
                              <>
                                 <div
                                    className="size-2.5 shrink-0 rounded-[2px]"
                                    style={{ backgroundColor: colors.get(name) }} />
                                 <div className="flex flex-1 items-center justify-between gap-4 leading-none">
                                    <span className="text-muted-foreground">
                                       {name === OTHERS ? `${item?.payload?.assets} other assets` : name}
                                    </span>
                                    <span className="font-mono font-medium tabular-nums text-foreground">
                                       {asDollarAmount(value)}
                                       {item?.payload?.amount !== undefined &&
                                          <span className="ml-2 font-normal text-muted-foreground">
                                             {asAssetAmount(item.payload.amount)} {name}
                                          </span>}
                                    </span>
                                 </div>
                              </>} />} />
                     {/* Animation is off for the same reason as the fee chart: under
                         StrictMode the sectors can stay stuck on their first frame. */}
                     <Pie
                        data={slices}
                        dataKey="value"
                        nameKey="asset"
                        innerRadius={60}
                        strokeWidth={2}
                        stroke="var(--card)"
                        isAnimationActive={false}>
                        {slices.map(slice =>
                           <Cell key={slice.asset} fill={colors.get(slice.asset)} />)}
                     </Pie>
                     <ChartLegend content={<ChartLegendContent nameKey="asset" />} />
                  </PieChart>
               </ChartContainer>}

            <p className="text-xs text-muted-foreground">
               What each asset is worth as a share of every reward earned, at today&apos;s prices —
               so this is where the value sits now, not where it was earned.
               {slices.some(slice => slice.asset === OTHERS) &&
                  ` Everything outside the top ${MAX_SLICES - 1} is folded into ${OTHERS}, worth ` +
                  `${asPercentage((slices.at(-1).value) / total)} of the total between them.`}
            </p>

         </CardContent>
      </Card>
   )
}
