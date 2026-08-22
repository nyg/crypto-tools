import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import Donut from './donut'
import { migrationOf, migrationSummary } from './asset-migrations'
import { placementColor, placementLabel, placementOf } from './placement'

// Every position, valued in USD and grouped by where it sits. Positions in an asset
// Kraken has no USD pair for cannot be added to the others and are counted apart, so
// that the ring never quietly omits a holding without saying so — and the assets they
// are in are named, because "left out" is only actionable if you know what was.
export function placementTotals(assets, rates) {

   const totals = new Map()
   const unvaluedAssets = new Set()
   const migratedAssets = new Set()
   let unvalued = 0
   let migrated = 0

   for (const asset of assets ?? []) {
      const rate = rates?.[asset.asset]
      for (const position of asset.positions) {
         if (rate == null) {
            if (migrationOf(asset.asset)) {
               migrated++
               migratedAssets.add(asset.asset)
            }
            else {
               unvalued++
               unvaluedAssets.add(asset.asset)
            }
            continue
         }
         const key = placementOf(position)
         const total = totals.get(key) ?? { key, label: placementLabel(key, position), value: 0, positions: 0 }
         total.value += position.amountNum * rate
         total.positions++
         totals.set(key, total)
      }
   }

   const slices = [...totals.values()].toSorted((a, b) => b.value - a.value)

   return {
      slices,
      unvalued,
      unvaluedAssets: [...unvaluedAssets].toSorted(),
      migrated,
      migratedAssets: [...migratedAssets].toSorted()
   }
}


export default function BalancePlacementCard({ balances, rates }) {

   const { slices, unvalued, unvaluedAssets, migrated, migratedAssets } = placementTotals(balances?.assets, rates)

   return (
      <Card>
         <CardHeader>
            <CardTitle>Where it sits</CardTitle>
         </CardHeader>
         <CardContent className="space-y-3">

            {/* Ordered biggest share first, so the legend reads down in the order its
                percentages do, and coloured the same way wherever a placement is named,
                so the ring can still be read against the badges in the table. */}
            <Donut
               slices={slices}
               colorFor={slice => placementColor(slice.key)}
               emptyText="Nothing to chart: none of the assets held could be valued in USD." />

            {unvalued > 0 &&
               <p className="text-xs text-muted-foreground">
                  <span
                     className="underline decoration-dotted underline-offset-2"
                     title={`No USD pair: ${unvaluedAssets.join(', ')}`}>
                     {unvalued} position{unvalued === 1 ? '' : 's'}
                  </span>
                  {' '}in assets with no USD pair{unvalued === 1 ? ' is' : ' are'} left out.
               </p>}

            {migrated > 0 &&
               <p className="text-xs text-muted-foreground">
                  <span
                     className="cursor-help underline decoration-dotted underline-offset-2"
                     title={migratedAssets.map(migrationSummary).join(' · ')}>
                     {migrated} position{migrated === 1 ? '' : 's'}
                  </span>
                  {' '}left behind by a token migration{migrated === 1 ? ' is' : ' are'} left out.
               </p>}

         </CardContent>
      </Card>
   )
}
