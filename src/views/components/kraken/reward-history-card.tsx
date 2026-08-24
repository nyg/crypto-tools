import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import ComboboxField from '../lib/combobox-field'
import { asAssetAmount, asCompact, asDollarAmount, asRounded } from '../../../utils/format'
import type { RewardSummary } from '../../../types/api'
import type { UsdRates } from '../../../types/kraken'

const EVERYTHING = 'ALL'

// Ticks stay short where the values do not: a dollar total wants no decimals, an
// amount of BTC still has to show that it is not zero.
const asAxisTick = (value: number) => {
   const magnitude = Math.abs(value)
   if (magnitude === 0) return '0'
   if (magnitude >= 1000) return asCompact(value)
   if (magnitude >= 1) return asRounded(value)
   return Number(value.toPrecision(2)).toString()
}


export default function RewardHistoryCard({ rewards, rates }: {
   rewards?: RewardSummary
   rates?: UsdRates
}) {

   const [asset, setAsset] = useState(EVERYTHING)

   const years = rewards?.years ?? []
   const assets = rewards?.assets ?? []

   // Falls back to the total whenever the chosen asset is not in the data, so the card
   // never goes blank on a re-sync that dropped it.
   const selected = assets.find(row => row.asset === asset)
   const isTotal = asset === EVERYTHING || !selected

   // Every asset on one axis only works in a common unit, so the total is in USD and a
   // single asset is charted in its own amount — mixing them would make both unreadable.
   const priced = rates ?? {}

   const data = years.map(year => ({
      year: String(year),
      value: isTotal
         ? assets.reduce((sum, row) =>
            sum + (priced[row.asset] != null ? (row.byYear[year] ?? 0) * priced[row.asset] : 0), 0)
         : selected!.byYear[year] ?? 0
   }))

   const format = (value: number) => isTotal ? asDollarAmount(value) : `${asAssetAmount(value)} ${asset}`

   const options = [
      { value: EVERYTHING, label: 'All assets (USD)' },
      ...assets.map(row => ({ value: row.asset, label: row.asset }))
   ]

   return (
      <Card>
         <CardHeader>
            <CardTitle>Over time</CardTitle>
            <CardAction>
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

            {data.length === 0
               ? <p className="text-sm text-muted-foreground">
                  No rewards to chart. Sync your ledger on the Ledger tab first.
               </p>
               : <ChartContainer
                  config={{ value: { label: 'Rewards', color: 'var(--chart-1)' } }}
                  className="h-[260px] w-full">
                  <BarChart data={data} margin={{ top: 8, right: 8 }}>
                     <CartesianGrid vertical={false} />
                     <XAxis dataKey="year" tickLine={false} axisLine={false} tickMargin={8} />
                     <YAxis tickLine={false} axisLine={false} tickMargin={8} width={64} tickFormatter={asAxisTick} />
                     <ChartTooltip content={
                        <ChartTooltipContent
                           hideIndicator
                           labelFormatter={(_, payload) => String(payload?.[0]?.payload?.year ?? '')}
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
