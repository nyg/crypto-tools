import { Card, CardContent,CardHeader, CardTitle } from '@/components/ui/card'

import type { LiveBalance, UsdRates } from '../../../types/kraken'
import Donut, { foldSlices } from './donut'


export default function BalanceChartCard({ assets, rates }: {
   assets?: LiveBalance[]
   rates?: UsdRates
}) {

   const priced = rates ?? {}

   const slices = foldSlices((assets ?? [])
      .filter(asset => priced[asset.asset] != null)
      .map(asset => ({
         key: asset.asset,
         label: asset.asset,
         value: asset.totalNum * (priced[asset.asset] ?? 0),
         amount: asset.totalNum
      })))

   return (
      <Card>
         <CardHeader>
            <CardTitle>Allocation</CardTitle>
         </CardHeader>
         <CardContent className="space-y-3">
            <Donut
               slices={slices}
               emptyText="Nothing to chart: none of the assets held could be valued in USD." />
         </CardContent>
      </Card>
   )
}
