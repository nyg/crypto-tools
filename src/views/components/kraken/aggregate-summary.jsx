import { cn } from '@/lib/utils'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { asDecimal } from '../../../utils/format'
import { asCount } from '../lib/filter-options'
import { convertQuotes } from '../../lib/quote-conversion'

const decimalsIn = (value) => (String(value).split('.')[1] ?? '').length

const decimalsOf = (quotes, key, minimum) =>
   Math.max(minimum, ...quotes.map(quote => decimalsIn(quote[key])))

// Below this share of the volume traded, the two sides have cancelled each other out
// and the net price stops being about the range.
const NET_FLOOR = 1 / 3

const VWAP_HINT = 'Volume-weighted average price: the average price paid or received per unit, with the bigger orders counting more than the smaller ones.'

export default function AggregateSummary({ summary, market, targetQuote, rateAt, isLoadingRates }) {

   if (!market || !summary) return null

   const bought = convertQuotes(summary.buy.quotes, targetQuote, rateAt)
   const sold = convertQuotes(summary.sell.quotes, targetQuote, rateAt)

   const allQuotes = [...summary.buy.quotes, ...summary.sell.quotes]

   if (allQuotes.length === 0) return null

   const missing = [...new Set([...bought.missing, ...sold.missing])]
   const pending = isLoadingRates && missing.length === 0 && (bought.converted || sold.converted)

   const volume = bought.volume.minus(sold.volume)
   const cost = bought.cost.minus(sold.cost)
   const fee = bought.fee.plus(sold.fee)

   const volumeDecimals = decimalsOf(allQuotes, 'volume', 8)
   const costDecimals = decimalsOf(allQuotes, 'cost', 2)
   const priceDecimals = decimalsOf(allQuotes, 'price', 2)

   const amount = (value, decimals) => asDecimal(Number(value.toFixed(decimals)), decimals)

   // The net line answers what the range did on balance: the volume that stayed, and
   // the price it stayed at once the trades of the other side are paid for. It only
   // means something while one side dominates — two sides that cancel out divide a
   // leftover cost by almost no volume, which prints a price out of all proportion to
   // the range rather than a number worth reading.
   const traded = bought.volume.plus(sold.volume)
   const cancelled = traded.eq(0) || volume.abs().lt(traded.times(NET_FLOOR))

   const netRatio = cancelled ? null : cost.div(volume)
   const netPrice = netRatio === null || netRatio.lte(0) ? null : netRatio

   const netPriceTitle = netPrice !== null || traded.eq(0)
      ? undefined
      : cancelled
         ? 'The range bought and sold about the same volume, so what it cost on balance says nothing about the price it traded at.'
         : 'The other side of the range more than paid for this one, so what is left has no price of its own.'

   const rows = [
      {
         key: 'buy',
         label: 'Bought',
         side: summary.buy,
         volume: bought.volume,
         cost: bought.cost,
         fee: bought.fee,
         price: bought.price,
         className: 'text-emerald-700 dark:text-emerald-300'
      },
      {
         key: 'sell',
         label: 'Sold',
         side: summary.sell,
         volume: sold.volume,
         cost: sold.cost,
         fee: sold.fee,
         price: sold.price,
         className: 'text-rose-700 dark:text-rose-300'
      },
      {
         key: 'net',
         label: volume.lt(0) ? 'Net sold' : 'Net bought',
         volume: volume.abs(),
         cost: cost.abs(),
         fee,
         price: netPrice,
         priceTitle: netPriceTitle,
         className: 'font-medium'
      }
   ]

   const missingNote = missing.length > 0
      ? `No rate for ${missing.join(', ')}, so those orders are left out.`
      : null

   return (
      <div className="space-y-2 border-t border-border pt-4">

         <Table className="tabular-nums">
            <TableHeader>
               <TableRow>
                  <TableHead>Range</TableHead>
                  <TableHead />
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">
                     <span className="cursor-help" title={VWAP_HINT}>VWAP</span>
                  </TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
               </TableRow>
            </TableHeader>
            <TableBody>
               {rows.map(row =>
                  <TableRow key={row.key}>
                     <TableCell className={cn('whitespace-nowrap', row.className)}>
                        {row.label}
                     </TableCell>
                     <TableCell className="whitespace-nowrap text-muted-foreground">
                        {row.side && asCount(row.side.orderCount, 'order')}
                     </TableCell>
                     <TableCell className="text-right whitespace-nowrap">
                        {amount(row.volume, volumeDecimals)}{' '}
                        <span className="text-muted-foreground">{market.baseAsset}</span>
                     </TableCell>
                     <TableCell
                        className={cn('text-right whitespace-nowrap', row.className)}
                        title={row.priceTitle}>
                        {row.price === null
                           ? '—'
                           : <>{amount(row.price, priceDecimals)}{' '}
                              <span className="text-muted-foreground">{targetQuote}</span></>}
                     </TableCell>
                     <TableCell className="text-right whitespace-nowrap">
                        {amount(row.cost, costDecimals)}{' '}
                        <span className="text-muted-foreground">{targetQuote}</span>
                     </TableCell>
                     <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                        {amount(row.fee, costDecimals)}
                     </TableCell>
                  </TableRow>)}
            </TableBody>
         </Table>

         {(pending || missingNote) &&
            <p className="text-xs text-muted-foreground">
               {pending ? 'Converting the other quote currencies…' : missingNote}
            </p>}

         <div className="border-t border-border" />

      </div>
   )
}
