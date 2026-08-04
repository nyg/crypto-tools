import { asAssetAmount, asPercentage, asLongDate } from '../../../utils/format'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'


export default function NextRedemptions({ data }) {

   const positions = data.balance.flatMap(asset => asset.staking.positions)
   positions.sort((p, q) => p.deliverDate - q.deliverDate)

   if (positions.length === 0) {
      return <p className="text-sm text-muted-foreground">No staking positions are currently open.</p>
   }

   return (
      <div className="overflow-x-auto">
         <Table>
            <TableHeader>
               <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">APY</TableHead>
                  <TableHead className="text-right">Progress</TableHead>
                  <TableHead className="text-right">Redemption date</TableHead>
               </TableRow>
            </TableHeader>
            <TableBody>
               {positions.map(position =>
                  <TableRow key={position.id}>
                     <TableCell className="font-medium">{position.asset}</TableCell>
                     <TableCell className="text-right tabular-nums">{asAssetAmount(position.amount)}</TableCell>
                     <TableCell className="text-right tabular-nums">{asPercentage(position.apy)}</TableCell>
                     <TableCell className="text-right tabular-nums">
                        {position.accrualDays} of {position.duration} days
                     </TableCell>
                     <TableCell className="text-right tabular-nums">{asLongDate(position.endDate)}</TableCell>
                  </TableRow>
               )}
            </TableBody>
         </Table>
      </div>
   )
}
