import * as format from '../../utils/format'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption } from '@/components/ui/table'


export default function NextRedemptions({ data }) {

   const positions = data.balance.flatMap(b => b.staking.positions)
   positions.sort((p, q) => p.deliverDate - q.deliverDate)

   return (
      <div className="w-1/3 h-32 overflow-auto">
         <Table className="w-full">
            <TableCaption className="caption-top mt-0 mb-2">Next redemptions</TableCaption>
            <TableHeader>
               <TableRow>
                  <TableHead className="text-left">Asset</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">APY</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead className="text-right">Redemption date</TableHead>
               </TableRow>
            </TableHeader>
            <TableBody>
               {positions.map(position => (
                  <TableRow key={position.id}>
                     <TableCell className="text-left">{position.asset}</TableCell>
                     <TableCell className="text-right">{format.asDecimal(position.amount)}</TableCell>
                     <TableCell className="text-right">{format.asPercentage(position.apy)}</TableCell>
                     <TableCell className="text-right">{position.accrualDays} of {position.duration}</TableCell>
                     <TableCell className="text-right">{format.asLongDate(position.endDate)}</TableCell>
                  </TableRow>
               ))}
            </TableBody>
         </Table>
      </div>
   )
}
