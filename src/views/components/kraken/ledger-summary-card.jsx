import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
   Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell
} from '@/components/ui/table'
import { asDecimal } from '../../../utils/format'

const asAmount = (value) => value === null || value === undefined || value === ''
   ? '—'
   : asDecimal(value, 8)

export default function LedgerSummaryCard({ summary }) {

   const assets = summary?.assets ?? []

   return (
      <Card>
         <CardHeader>
            <CardTitle>Summary</CardTitle>
            {summary &&
               <CardAction>
                  <Badge variant="outline">
                     {summary.totals.assetCount} {summary.totals.assetCount === 1 ? 'asset' : 'assets'}
                  </Badge>
               </CardAction>}
         </CardHeader>
         <CardContent className="space-y-3">

            {assets.length === 0
               ? <p className="text-sm text-muted-foreground">
                  Nothing to summarise yet. Sync your ledger above to see totals per asset.
               </p>
               : <>
                  <div className="overflow-x-auto">
                     <Table className="tabular-nums">
                        <TableHeader>
                           <TableRow>
                              <TableHead>Asset</TableHead>
                              <TableHead className="text-right">Entries</TableHead>
                              <TableHead className="text-right">Net amount</TableHead>
                              <TableHead className="text-right">Fees</TableHead>
                              <TableHead className="text-right">Rewards</TableHead>
                              <TableHead className="text-right">Balance</TableHead>
                           </TableRow>
                        </TableHeader>
                        <TableBody>
                           {assets.map(asset =>
                              <TableRow key={asset.asset}>
                                 <TableCell className="font-medium">{asset.asset}</TableCell>
                                 <TableCell className="text-right">{asset.count.toLocaleString('en-GB')}</TableCell>
                                 <TableCell className="text-right">{asAmount(asset.netAmount)}</TableCell>
                                 <TableCell className="text-right text-muted-foreground">{asAmount(asset.feeTotal)}</TableCell>
                                 <TableCell className="text-right">
                                    {Number(asset.rewardAmount) === 0
                                       ? <span className="text-muted-foreground">—</span>
                                       : asAmount(asset.rewardAmount)}
                                 </TableCell>
                                 <TableCell className="text-right">{asAmount(asset.balance)}</TableCell>
                              </TableRow>)}
                        </TableBody>
                        <TableFooter>
                           <TableRow>
                              <TableCell>Total</TableCell>
                              <TableCell className="text-right">
                                 {summary.totals.entryCount.toLocaleString('en-GB')}
                              </TableCell>
                              <TableCell colSpan={4} />
                           </TableRow>
                        </TableFooter>
                     </Table>
                  </div>

                  <p className="text-xs text-muted-foreground">
                     Net amount is the total received less fees. Balance is the running balance Kraken
                     reported on the most recent entry for that asset, not a live balance.
                  </p>
               </>}

         </CardContent>
      </Card>
   )
}
