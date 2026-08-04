import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { asAssetAmount, asPercentage } from '../../../utils/format'

// Kraken records ledger times in UTC; rendering them in the browser's zone would
// silently shift every entry.
const asUtcTimestamp = (time) => new Date(time).toISOString().replace('T', ' ').slice(0, 19)


export default function FeeBreakdownCard({ fees, colors, asset }) {

   const assetTotals = new Map((fees?.assets ?? []).map(row => [row.asset, row.total]))
   const byType = fees?.byType ?? []
   const largest = (fees?.largest ?? []).filter(entry => entry.baseAsset === asset)

   return (
      <Card>
         <CardHeader>
            <CardTitle>By type</CardTitle>
            {asset && <CardAction><Badge variant="outline">{asset}</Badge></CardAction>}
         </CardHeader>
         <CardContent className="space-y-6">

            {byType.length === 0
               ? <p className="text-sm text-muted-foreground">
                  No fees in the stored ledger for these filters.
               </p>
               : <div className="overflow-x-auto">
                  <Table className="tabular-nums">
                     <TableHeader>
                        <TableRow>
                           <TableHead>Type</TableHead>
                           <TableHead>Asset</TableHead>
                           <TableHead className="text-right">Total fees</TableHead>
                           <TableHead className="text-right">Fees</TableHead>
                           <TableHead className="text-right">Share of asset</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {byType.map(row =>
                           <TableRow key={`${row.asset}-${row.type}`}>
                              <TableCell>
                                 <div className="flex items-center gap-2">
                                    <span
                                       className="size-2.5 shrink-0 rounded-[2px]"
                                       style={{ backgroundColor: colors.get(row.type) }} />
                                    <Badge variant="secondary">{row.type}</Badge>
                                 </div>
                              </TableCell>
                              <TableCell className="font-medium">{row.asset}</TableCell>
                              <TableCell className="text-right font-medium">
                                 {asAssetAmount(row.total)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                 {row.entries.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                 {assetTotals.get(row.asset)
                                    ? asPercentage(row.total / assetTotals.get(row.asset))
                                    : '—'}
                              </TableCell>
                           </TableRow>)}
                     </TableBody>
                  </Table>
               </div>}

            {largest.length > 0 &&
               <div className="space-y-3 border-t border-border pt-4">
                  <p className="text-sm font-medium">Largest single fees</p>
                  <div className="overflow-x-auto">
                     <Table className="tabular-nums">
                        <TableHeader>
                           <TableRow>
                              <TableHead>Time (UTC)</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead className="text-right">Fee</TableHead>
                              <TableHead>Wallet</TableHead>
                              <TableHead>Ref</TableHead>
                           </TableRow>
                        </TableHeader>
                        <TableBody>
                           {largest.map(entry =>
                              <TableRow key={entry.txid || `${entry.refid}-${entry.time}`}>
                                 <TableCell className="whitespace-nowrap">
                                    {asUtcTimestamp(entry.time)}
                                 </TableCell>
                                 <TableCell>
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                       <Badge variant="secondary">{entry.type}</Badge>
                                       {entry.subtype &&
                                          <span className="text-xs text-muted-foreground">{entry.subtype}</span>}
                                    </div>
                                 </TableCell>
                                 <TableCell className="text-right font-medium">{entry.fee}</TableCell>
                                 <TableCell className="text-muted-foreground">{entry.wallet || '—'}</TableCell>
                                 <TableCell className="font-mono text-xs text-muted-foreground">
                                    {entry.refid || '—'}
                                 </TableCell>
                              </TableRow>)}
                        </TableBody>
                     </Table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                     The ten biggest single fees charged in {asset}. Ranked per asset, because a
                     large number of one coin is not a bigger fee than a small number of another —
                     change the asset above to see a different one.
                  </p>
               </div>}

         </CardContent>
      </Card>
   )
}
