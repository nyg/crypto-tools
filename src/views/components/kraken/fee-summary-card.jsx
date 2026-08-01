import { Loader2Icon } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import LedgerFilters from './ledger-filters'
import Field from '../lib/field'
import { asAssetAmount, asLongDate, asPercentage } from '../../../utils/format'


export default function FeeSummaryCard({ fees, filters, filtersKey, options, isLoading, onFiltersChange, onFiltersReset }) {

   const assets = fees?.assets ?? []
   const entries = fees?.entries ?? 0

   return (
      <Card>
         <CardHeader>
            <CardTitle>Fees paid</CardTitle>
            <CardAction>
               {isLoading
                  ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                  : <Badge variant="outline">{entries.toLocaleString('en-GB')} charged</Badge>}
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

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-4 md:grid-cols-4">
               <Field label="Assets charged in">{assets.length.toLocaleString('en-GB')}</Field>
               <Field label="Fees charged">{entries.toLocaleString('en-GB')}</Field>
               <Field label="First fee">{fees?.first ? asLongDate(fees.first) : '—'}</Field>
               <Field label="Last fee">{fees?.last ? asLongDate(fees.last) : '—'}</Field>
            </div>

            {assets.length === 0
               ? <p className="text-sm text-muted-foreground">
                  No fees in the stored ledger for these filters.
               </p>
               : <div className="overflow-x-auto">
                  <Table className="tabular-nums">
                     <TableHeader>
                        <TableRow>
                           <TableHead>Asset</TableHead>
                           <TableHead className="text-right">Total fees</TableHead>
                           <TableHead className="text-right">Fees</TableHead>
                           <TableHead className="text-right">Share</TableHead>
                           <TableHead className="text-right">First</TableHead>
                           <TableHead className="text-right">Last</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {assets.map(asset =>
                           <TableRow key={asset.asset}>
                              <TableCell className="font-medium">{asset.asset}</TableCell>
                              <TableCell className="text-right font-medium">
                                 {asAssetAmount(asset.total)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                 {asset.entries.toLocaleString('en-GB')}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                 {asPercentage(asset.entries / entries)}
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                                 {asLongDate(asset.first)}
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                                 {asLongDate(asset.last)}
                              </TableCell>
                           </TableRow>)}
                     </TableBody>
                  </Table>
               </div>}

            <p className="text-xs text-muted-foreground">
               Every total is in the asset the fee was charged in — a trade fee lands in the
               pair&apos;s quote currency, a withdrawal fee in the coin withdrawn. Nothing is
               converted between assets, so <b>Share</b> compares how many fees each asset was
               charged in, not how much they were worth.
            </p>

         </CardContent>
      </Card>
   )
}
