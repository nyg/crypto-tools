import { asAssetAmount, asDollarAmount, asPercentage } from '../../../utils/format'
import { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell } from '@/components/ui/table'

const Missing = () => <span className="text-muted-foreground">—</span>

export default function TakeProfitTable({ result }) {

   const { tpLevels, totals } = result

   if (tpLevels.length === 0) {
      return (
         <p className="text-sm text-muted-foreground">
            Fill in an entry price, a stop loss and a strategy to see the take profit levels.
         </p>
      )
   }

   return (
      <Table className="tabular-nums">
         <TableHeader>
            <TableRow>
               <TableHead>Level</TableHead>
               <TableHead className="text-right">Closed</TableHead>
               <TableHead className="text-right">Price</TableHead>
               <TableHead className="text-right">Quantity</TableHead>
               <TableHead className="text-right">Profit</TableHead>
               <TableHead className="text-right">ROI</TableHead>
            </TableRow>
         </TableHeader>
         <TableBody>
            {tpLevels.map(level =>
               <TableRow key={level.label}>
                  <TableCell className="font-medium">{level.label}</TableCell>
                  <TableCell className="text-right">{level.pct}%</TableCell>
                  <TableCell className="text-right">
                     {level.price ? asAssetAmount(level.price.toNumber()) : <Missing />}
                  </TableCell>
                  <TableCell className="text-right">
                     {level.quantity ? asAssetAmount(level.quantity.toNumber()) : <Missing />}
                  </TableCell>
                  <TableCell className="text-right">
                     {level.profit ? asDollarAmount(level.profit.toNumber()) : <Missing />}
                  </TableCell>
                  <TableCell className="text-right">
                     {level.roi ? asPercentage(level.roi.toNumber()) : <Missing />}
                  </TableCell>
               </TableRow>
            )}
         </TableBody>
         <TableFooter>
            <TableRow>
               <TableCell>Total</TableCell>
               <TableCell className="text-right">{totals.pct}%</TableCell>
               <TableCell></TableCell>
               <TableCell className="text-right">
                  {totals.quantity.gt(0) ? asAssetAmount(totals.quantity.toNumber()) : <Missing />}
               </TableCell>
               <TableCell className="text-right">
                  {totals.profit ? asDollarAmount(totals.profit.toNumber()) : <Missing />}
               </TableCell>
               <TableCell className="text-right">
                  {totals.roi ? asPercentage(totals.roi.toNumber()) : <Missing />}
               </TableCell>
            </TableRow>
         </TableFooter>
      </Table>
   )
}
