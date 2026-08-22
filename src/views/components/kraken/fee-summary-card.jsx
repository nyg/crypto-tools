import { Loader2Icon } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import LedgerFilters from './ledger-filters'
import { asAssetAmount, asNumber, asDollarAmount, asPercentage } from '../../../utils/format'

const valueOf = (total, rate) => rate == null ? null : total * rate


export default function FeeSummaryCard({ fees, rates, filters, filtersKey, options, isLoading, onFiltersChange, onFiltersReset }) {

   const entries = fees?.entries ?? 0

   const assets = (fees?.assets ?? [])
      .map(asset => ({ ...asset, value: valueOf(asset.total, rates?.[asset.asset]) }))
      .toSorted((a, b) => (b.value ?? -1) - (a.value ?? -1))

   const totalValue = assets.reduce((sum, asset) => sum + (asset.value ?? 0), 0)

   return (
      <Card>
         <CardHeader>
            <CardTitle>Fees paid</CardTitle>
            <CardAction>
               {isLoading
                  ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                  : <Badge variant="outline">{asNumber(entries)} charged</Badge>}
            </CardAction>
         </CardHeader>
         <CardContent className="space-y-4">

            <LedgerFilters
               key={filtersKey}
               filters={filters}
               options={options}
               onChange={onFiltersChange}
               onReset={onFiltersReset}
               showSearch={false} />

            {assets.length === 0
               ? <p className="text-sm text-muted-foreground">
                  No fees in the stored ledger for these filters.
               </p>
               : <div className="overflow-x-auto border-t border-border pt-4">
                  <Table className="tabular-nums">
                     <TableHeader>
                        <TableRow>
                           <TableHead>Asset</TableHead>
                           <TableHead className="text-right">Fees</TableHead>
                           <TableHead className="text-right">Total fees</TableHead>
                           <TableHead className="text-right">Total fees (USD)</TableHead>
                           <TableHead className="text-right">Share</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {assets.map(asset =>
                           <TableRow key={asset.asset}>
                              <TableCell className="font-medium">{asset.asset}</TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                 {asNumber(asset.entries)}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                 {asAssetAmount(asset.total)}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                 {asset.value == null ? '—' : asDollarAmount(asset.value)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                 {asset.value == null || totalValue === 0
                                    ? '—'
                                    : asPercentage(asset.value / totalValue)}
                              </TableCell>
                           </TableRow>)}
                     </TableBody>
                  </Table>
               </div>}

         </CardContent>
      </Card>
   )
}
