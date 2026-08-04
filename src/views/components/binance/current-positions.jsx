import { asAssetAmount, asDollarAmount } from '../../../utils/format'
import { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell } from '@/components/ui/table'

const asAmount = value => value ? asAssetAmount(value) : '—'

export default function CurrentPositions({ data }) {

   const total = data.balance.reduce((sum, asset) => sum + (asset.fiatValue ?? 0), 0)

   return (
      <div className="overflow-x-auto">
         <Table>
            <TableHeader>
               <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead className="text-right">Spot</TableHead>
                  <TableHead className="text-right">Staking</TableHead>
                  <TableHead className="text-right">Locked</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Value</TableHead>
               </TableRow>
            </TableHeader>
            <TableBody>
               {data.balance.map(({ asset, free, locked, staking, total: assetTotal, fiatValue }) =>
                  <TableRow key={asset}>
                     <TableCell className="font-medium">{asset}</TableCell>
                     <TableCell className="text-right tabular-nums">{asAmount(free)}</TableCell>
                     <TableCell className="text-right tabular-nums">{asAmount(staking?.balance)}</TableCell>
                     <TableCell className="text-right tabular-nums">{asAmount(locked)}</TableCell>
                     <TableCell className="text-right tabular-nums">{asAmount(assetTotal)}</TableCell>
                     <TableCell className="text-right tabular-nums">{asDollarAmount(fiatValue)}</TableCell>
                  </TableRow>
               )}
            </TableBody>
            <TableFooter>
               <TableRow>
                  <TableCell colSpan={5}>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{asDollarAmount(total)}</TableCell>
               </TableRow>
            </TableFooter>
         </Table>
      </div>
   )
}
