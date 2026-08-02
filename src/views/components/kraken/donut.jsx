import { Cell, Pie, PieChart } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import { asAssetAmount, asDollarAmount, asPercentage } from '../../../utils/format'

// A slice thinner than this is a sliver on the ring and a line in the legend that says
// nothing, so the whole tail is folded into one "Others" slice — the tables below still
// break it down row by row. The cap is the backstop for a spread flat enough that
// nothing falls under the threshold.
const MIN_SHARE = 0.01
const MAX_SLICES = 8

export const OTHERS = 'others'

// Takes slices of { key, label, value, amount? } and returns the ones worth drawing.
// A value that cannot be worked out — an asset Kraken has no USD pair for — belongs to
// the caller to drop before this: a slice with no size cannot be drawn either way.
export function foldSlices(slices, othersLabel = count => `${count} others`) {

   const valued = slices
      // A holding can go negative in principle; a negative slice cannot be drawn.
      .filter(slice => slice.value > 0)
      .toSorted((a, b) => b.value - a.value)

   const total = valued.reduce((sum, slice) => sum + slice.value, 0)

   const keptByShare = valued.filter(slice => slice.value / total >= MIN_SHARE)
   const kept = keptByShare.slice(0, MAX_SLICES - 1)
   const others = valued.slice(kept.length)

   // Folding a single slice into "Others" hides its name for nothing.
   if (others.length <= 1) return valued

   return [
      ...kept,
      {
         key: OTHERS,
         label: othersLabel(others.length),
         value: others.reduce((sum, slice) => sum + slice.value, 0)
      }
   ]
}

// The USD donut every card on this page and the Rewards page draws: a ring, and a
// legend that carries each slice's share rather than repeating it in a paragraph
// underneath — that share is what the card is read for and it costs no height there.
//
// colorFor lets a caller whose slices have a fixed running order (the wallets a coin
// can sit in) keep one colour per slice instead of colouring by rank.
export default function Donut({ slices, colorFor, emptyText }) {

   const total = slices.reduce((sum, slice) => sum + slice.value, 0)

   if (slices.length === 0 || total <= 0) {
      return <p className="text-sm text-muted-foreground">{emptyText}</p>
   }

   const colors = new Map(slices.map((slice, index) => [
      slice.key,
      colorFor?.(slice) ?? (slice.key === OTHERS ? 'var(--muted-foreground)' : `var(--chart-${(index % 8) + 1})`)
   ]))

   const config = Object.fromEntries(slices.map(slice =>
      [slice.key, {
         color: colors.get(slice.key),
         label:
            <span className="flex w-full items-baseline justify-between gap-3">
               <span>{slice.label}</span>
               <span className="tabular-nums text-muted-foreground">
                  {asPercentage(slice.value / total)}
               </span>
            </span>
      }]))

   return (
      <ChartContainer config={config} className="h-[260px] w-full">
         <PieChart>
            <ChartTooltip content={
               <ChartTooltipContent
                  hideLabel
                  nameKey="key"
                  formatter={(value, name, item) =>
                     <>
                        <div
                           className="size-2.5 shrink-0 rounded-[2px]"
                           style={{ backgroundColor: colors.get(name) }} />
                        <div className="flex flex-1 items-center justify-between gap-4 leading-none">
                           <span className="text-muted-foreground">{item?.payload?.label ?? name}</span>
                           <span className="font-mono font-medium tabular-nums text-foreground">
                              {asDollarAmount(value)}
                              {item?.payload?.amount !== undefined &&
                                 <span className="ml-2 font-normal text-muted-foreground">
                                    {asAssetAmount(item.payload.amount)} {item.payload.key}
                                 </span>}
                           </span>
                        </div>
                     </>} />} />
            {/* Animation is off for the same reason as the fee chart: under StrictMode
                the sectors can stay stuck on their first frame. */}
            <Pie
               data={slices}
               dataKey="value"
               nameKey="key"
               innerRadius={60}
               strokeWidth={2}
               stroke="var(--card)"
               isAnimationActive={false}>
               {slices.map(slice => <Cell key={slice.key} fill={colors.get(slice.key)} />)}
            </Pie>
            {/* itemSorter defaults to 'value', which for a pie legend is the slice name —
                the legend would come out alphabetical while the ring runs biggest-first.
                Null keeps both in the same order. */}
            <ChartLegend
               layout="vertical"
               align="right"
               verticalAlign="middle"
               width={140}
               itemSorter={null}
               content={<ChartLegendContent
                  nameKey="key"
                  className="flex-col items-stretch gap-2 pt-0 pl-3" />} />
         </PieChart>
      </ChartContainer>
   )
}
