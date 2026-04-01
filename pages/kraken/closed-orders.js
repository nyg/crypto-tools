import { useState, Fragment } from 'react'
import useSWRMutation from 'swr/mutation'
import KrakenLayout from '../../components/kraken/kraken-layout'
import DatePicker from '../../components/lib/date-picker'
import Input from '../../components/lib/input'
import * as format from '../../utils/format'
import Big from 'big.js'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2Icon, InfoIcon, AlertTriangleIcon } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableCaption } from '@/components/ui/table'


export default function KrakenClosedOrders() {

   const { data: orders, error, isMutating, trigger: getOrders } = useSWRMutation('/api/kraken/closed-orders')

   const [credentials, setCredentials] = useState(() => ({
      apiKey: (typeof window !== 'undefined' && localStorage.getItem('kraken.api.key')) || '',
      apiSecret: (typeof window !== 'undefined' && localStorage.getItem('kraken.api.secret')) || ''
   }))

   if (!credentials.apiKey) {
      return <KrakenLayout name="Closed Orders">
         <Alert>
            <AlertTriangleIcon />
            <AlertDescription>Generate an API key and secret on Kraken to be able to fetch closed orders.</AlertDescription>
         </Alert>
      </KrakenLayout>
   }

   const fetchOrders = event => {
      event.preventDefault()
      const formData = new FormData(event.target)
      const assetFilter = formData.get('asset')
      const fromDate = new Date(formData.get('date-from')).getTime() / 1000
      const toDate = new Date(formData.get('date-to')).getTime() / 1000
      getOrders({ credentials, searchParams: { assetFilter, fromDate, toDate } })
   }

   let orderContent
   if (error) {
      orderContent = <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
   }
   else if (isMutating) {
      orderContent = <div className="flex items-center gap-2"><Loader2Icon className="size-4 animate-spin" /> Loading…</div>
   }
   else if (orders) {
      orderContent = <>
         {Object.keys(orders).map(pair => (
            <Fragment key={pair}>
               <div className="flex items-center gap-3 pt-4">
                  <span className="font-semibold">{orders[pair].pair.name}</span>
                  <Separator className="flex-1" />
               </div>
               {Object.keys(orders[pair]).filter(key => ['buy', 'sell'].includes(key)).map(direction => (
                  <Table key={`${pair}-${direction}`} className="w-2/3 tabular-nums">
                     <TableCaption className="text-left font-bold mt-0 mb-2 caption-top">{direction} orders</TableCaption>
                     <TableHeader>
                        <TableRow>
                           <TableHead className="text-right">Date</TableHead>
                           <TableHead className="text-right">Volume</TableHead>
                           <TableHead className="text-right">Cost</TableHead>
                           <TableHead className="text-right">Price</TableHead>
                           <TableHead className="text-right">Identifier</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {orders[pair][direction].orders.map(order =>
                           <TableRow key={Math.random()}>
                              <TableCell className="text-right">{new Date(order.openedDate * 1000).toISOString()}</TableCell>
                              <TableCell className="text-right">{format.asDecimal(order.volume, orders[pair].pair.base.decimals)}</TableCell>
                              <TableCell className="text-right">{format.asDecimal(Big(order.cost).add(order.flags.includes('fciq') ? order.fee : 0), orders[pair].pair.quote.decimals)}</TableCell>
                              <TableCell className="text-right">{format.asDecimal(order.price, orders[pair].pair.quote.decimals)}</TableCell>
                              <TableCell className="text-right font-mono">{order.orderId}</TableCell>
                           </TableRow>)}
                     </TableBody>
                     <TableFooter>
                        <TableRow>
                           <TableHead></TableHead>
                           <TableHead className="text-right">{format.asDecimal(orders[pair][direction].summary.volume, orders[pair].pair.base.decimals)}</TableHead>
                           <TableHead className="text-right">{format.asDecimal(orders[pair][direction].summary.cost, orders[pair].pair.quote.decimals)}</TableHead>
                           <TableHead className="text-right">{format.asDecimal(orders[pair][direction].summary.price, orders[pair].pair.quote.decimals)}</TableHead>
                           <TableHead></TableHead>
                        </TableRow>
                     </TableFooter>
                  </Table>
               ))}
            </Fragment>
         ))}
      </>
   }
   else {
      orderContent = <Alert><InfoIcon /><AlertDescription>No orders</AlertDescription></Alert>
   }

   return (
      <KrakenLayout name="Closed Orders">
         <div className="space-y-4 text-sm tabular-nums">
            <p>Displays closed orders between the given dates, excludes orders with no volumes (e.g. cancelled orders).</p>
            <form onSubmit={fetchOrders}>
               <div className="flex items-end gap-4">
                  <Input name="asset" label="Asset filter" defaultValue="XBT" />
                  <DatePicker name="date-from" label="From" defaultValue="2023-01-01T00:00:00Z" />
                  <DatePicker name="date-to" label="To" defaultValue="2023-12-31T23:59:59Z" />
                  <Button type="submit" size="sm" className="mb-1">Search</Button>
               </div>
            </form>
            {orderContent}
         </div>
      </KrakenLayout>
   )
}
