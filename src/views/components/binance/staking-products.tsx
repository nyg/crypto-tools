import Big from 'big.js'
import { asAssetAmount, asPercentage } from '../../../utils/format'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { AggregateBalanceResponse, StakingProductInfo } from '../../../types/api'
import type { VariantProps } from 'class-variance-authority'
import type { badgeVariants } from '@/components/ui/badge'

interface Availability {
   variant: VariantProps<typeof badgeVariants>['variant']
   label: string
   detail?: string
}

// The asset is passed in rather than read off the product: the server's product info
// describes the product, and which asset it is for is the row it hangs under.
export function availabilityOf(
   { soldOut, maxStakingAmount, positionsAmount, minStakingAmount }: StakingProductInfo,
   asset: string,
   spot: Big
): Availability {

   const quota = Big(maxStakingAmount)
   const remaining = quota.minus(positionsAmount)

   if (remaining.eq(0)) {
      return {
         variant: 'destructive',
         label: soldOut ? 'Sold out' : 'Quota reached',
         detail: `your quota of ${asAssetAmount(quota.toNumber())} ${asset} is fully used`
      }
   }

   if (remaining.lt(minStakingAmount)) {
      return {
         variant: 'destructive',
         label: soldOut ? 'Sold out' : 'Quota too low',
         detail: `${asAssetAmount(remaining.toNumber())} ${asset} left, below the ${asAssetAmount(Number(minStakingAmount))} ${asset} minimum`
      }
   }

   if (soldOut) {
      return { variant: 'destructive', label: 'Sold out' }
   }

   if (spot.gt(remaining)) {
      return {
         variant: 'secondary',
         label: 'Limited',
         detail: `only ${asAssetAmount(remaining.toNumber())} ${asset} of your quota left`
      }
   }

   return { variant: 'default', label: 'Available' }
}


export default function StakingProducts({ data }: { data: AggregateBalanceResponse }) {

   const rows = data.balance.flatMap(({ asset, free, staking }) =>
      staking.products.map(product => ({
         asset,
         product,
         held: product.positions.reduce((sum, position) => sum + Number(position.amount), 0),
         availability: availabilityOf(product.info, asset, Big(free))
      })))

   if (rows.length === 0) {
      return <p className="text-sm text-muted-foreground">No staking products offered for these assets.</p>
   }

   return (
      <div className="overflow-x-auto">
         <Table>
            <TableHeader>
               <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead className="text-right">APY</TableHead>
                  <TableHead className="text-right">Your position</TableHead>
                  <TableHead>Availability</TableHead>
               </TableRow>
            </TableHeader>
            <TableBody>
               {rows.map(({ asset, product, held, availability }) =>
                  <TableRow key={product.info.id}>
                     <TableCell className="font-medium">{asset}</TableCell>
                     <TableCell className="text-right tabular-nums">{product.info.duration} days</TableCell>
                     <TableCell className="text-right tabular-nums">{asPercentage(Number(product.info.apy))}</TableCell>
                     <TableCell className="text-right tabular-nums">
                        {held > 0 ? asAssetAmount(held) : '—'}
                     </TableCell>
                     <TableCell>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                           <Badge variant={availability.variant}>{availability.label}</Badge>
                           {availability.detail &&
                              <span className="text-xs text-muted-foreground">{availability.detail}</span>}
                        </span>
                     </TableCell>
                  </TableRow>
               )}
            </TableBody>
         </Table>
      </div>
   )
}
