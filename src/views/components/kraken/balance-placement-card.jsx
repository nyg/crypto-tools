import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import Donut from './donut'
import { PLACEMENT_ORDER, placementColor, placementLabel, placementOf } from './placement'

// Every position, valued in USD and grouped by where it sits. Positions in an asset
// Kraken has no USD pair for cannot be added to the others and are counted apart, so
// that the ring never quietly omits a holding without saying so.
export function placementTotals(assets, rates) {

   const totals = new Map()
   let unvalued = 0

   for (const asset of assets ?? []) {
      const rate = rates?.[asset.asset]
      for (const position of asset.positions) {
         if (rate == null) {
            unvalued++
            continue
         }
         const key = placementOf(position)
         const total = totals.get(key) ?? { key, label: placementLabel(key, position), value: 0, positions: 0 }
         total.value += position.amountNum * rate
         total.positions++
         totals.set(key, total)
      }
   }

   const slices = [...totals.values()]
      .toSorted((a, b) => PLACEMENT_ORDER.indexOf(a.key) - PLACEMENT_ORDER.indexOf(b.key))

   return { slices, unvalued }
}


export default function BalancePlacementCard({ balances, rates }) {

   const { slices, unvalued } = placementTotals(balances?.assets, rates)

   return (
      <Card>
         <CardHeader>
            <CardTitle>Where it sits</CardTitle>
         </CardHeader>
         <CardContent className="space-y-3">

            {/* Ordered by placement rather than by size, and coloured the same way
                wherever a placement is named, so the ring can be read against the
                badges in the table without looking anything up. */}
            <Donut
               slices={slices}
               colorFor={slice => placementColor(slice.key)}
               emptyText="Nothing to chart: none of the assets held could be valued in USD." />

            {unvalued > 0 &&
               <p className="text-xs text-muted-foreground">
                  {unvalued} position{unvalued === 1 ? '' : 's'} in assets with no USD pair
                  {unvalued === 1 ? ' is' : ' are'} left out.
               </p>}

         </CardContent>
      </Card>
   )
}
