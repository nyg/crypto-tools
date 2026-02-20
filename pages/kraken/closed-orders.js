import { useEffect, useState, Fragment } from 'react'
import useSWRMutation from 'swr/mutation'
import KrakenLayout from '../../components/kraken/kraken-layout'
import DatePicker from '../../components/lib/date-picker'
import Input from '../../components/lib/input'
import * as format from '../../utils/format'
import Big from 'big.js'


export default function KrakenClosedOrders() {

   const { data: orders, error, isMutating, trigger: getOrders } = useSWRMutation('/api/kraken/closed-orders')

   const [credentials, setCredentials] = useState({ apiKey: '', apiSecret: '' })
   useEffect(() =>
      setCredentials({
         apiKey: localStorage.getItem('kraken.api.key'),
         apiSecret: localStorage.getItem('kraken.api.secret')
      }), [])

   if (!credentials.apiKey) {
      return <KrakenLayout name="Closed Orders">
         <div className="alert alert-warning text-sm">
            Generate an API key and secret on Kraken to be able to fetch closed orders.
         </div>
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
      orderContent = <div className="alert alert-error">{error}</div>
   }
   else if (isMutating) {
      orderContent = <div className="flex items-center gap-2"><span className="loading loading-spinner loading-sm"></span> Loading…</div>
   }
   else if (orders) {
      orderContent = <>
         {Object.keys(orders).map(pair => (
            <Fragment key={pair}>
               <div className="divider divider-start">{orders[pair].pair.name}</div>
               {Object.keys(orders[pair]).filter(key => ['buy', 'sell'].includes(key)).map(direction => (
                  <table key={`${pair}-${direction}`} className="table table-xs w-2/3 text-right tabular-nums">
                     <caption className="font-bold text-left">{direction} orders</caption>
                     <thead>
                        <tr>
                           <th>Date</th>
                           <th>Volume</th>
                           <th>Cost</th>
                           <th>Price</th>
                           <th>Identifier</th>
                        </tr>
                     </thead>
                     <tbody>
                        {orders[pair][direction].orders.map(order =>
                           <tr key={Math.random()}>
                              <td>{new Date(order.openedDate * 1000).toISOString()}</td>
                              <td>{format.asDecimal(order.volume, orders[pair].pair.base.decimals)}</td>
                              <td>{format.asDecimal(Big(order.cost).add(order.flags.includes('fciq') ? order.fee : 0), orders[pair].pair.quote.decimals)}</td>
                              <td>{format.asDecimal(order.price, orders[pair].pair.quote.decimals)}</td>
                              <td className="font-mono">{order.orderId}</td>
                           </tr>)}
                     </tbody>
                     <tfoot>
                        <tr>
                           <th></th>
                           <th>{format.asDecimal(orders[pair][direction].summary.volume, orders[pair].pair.base.decimals)}</th>
                           <th>{format.asDecimal(orders[pair][direction].summary.cost, orders[pair].pair.quote.decimals)}</th>
                           <th>{format.asDecimal(orders[pair][direction].summary.price, orders[pair].pair.quote.decimals)}</th>
                           <th></th>
                        </tr>
                     </tfoot>
                  </table>
               ))}
            </Fragment>
         ))}
      </>
   }
   else {
      orderContent = <div className="alert alert-info">No orders</div>
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
                  <button className="btn btn-sm btn-neutral mb-1">Search</button>
               </div>
            </form>
            {orderContent}
         </div>
      </KrakenLayout>
   )
}
