import { useEffect, useState, Fragment } from 'react'
import useSWRMutation from 'swr/mutation'
import KrakenLayout from '../../components/kraken/kraken-layout'
import Input from '../../components/lib/input'
import * as format from '../../utils/format'


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
         <div className="text-sm">
            Generate an API key and secret on Kraken to be able to fetch closed orders.
         </div>
      </KrakenLayout>
   }

   const fetchOrders = event => {
      event.preventDefault()
      const formData = new FormData(event.target)
      const asset = formData.get('asset')
      const fromDate = new Date(formData.get('date-from')).getTime() / 1000
      const toDate = new Date(formData.get('date-to')).getTime() / 1000
      getOrders({ credentials, searchParams: { asset, fromDate, toDate } })
   }

   let orderContent
   if (error) {
      orderContent = <span>{error}</span>
   }
   else if (isMutating) {
      orderContent = <span>Loading…</span>
   }
   else if (orders) {
      orderContent = <>
         {Object.keys(orders).map(pair => (
            <Fragment key={pair}>
               <h3 className="border-b border-black">{orders[pair].pair.name}</h3>
               {Object.keys(orders[pair]).filter(key => ['buy', 'sell'].includes(key)).map(direction => (
                  <table key={`${pair}-${direction}`} className="w-2/3 text-right tabular-nums">
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
                     <tbody className="border-b border-t border-gray-400">
                        {orders[pair][direction].orders.map(order =>
                           <tr key={Math.random()}>
                              <td>{new Date(order.openedDate * 1000).toISOString()}</td>
                              <td>{order.volume}</td>
                              <td>{order.cost}</td>
                              <td>{order.price}</td>
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
      orderContent = <span>No orders</span>
   }


   return (
      <KrakenLayout name="Closed Orders">
         <div className="space-y-4 text-sm tabular-nums">
            <p>Displays closed orders between the given dates, excludes orders with no volumes (e.g. cancelled orders).</p>
            <h3 className="font-semibold">Parameters</h3>
            <form onSubmit={fetchOrders}>
               <div className="flex items-end gap-4">
                  <Input name="asset" label="Asset filter" defaultValue="XBT" />
                  <Input name="date-from" label="From" defaultValue="2023-01-01T00:00:00Z" />
                  <Input name="date-to" label="To" defaultValue="2023-12-31T23:59:59Z" />
                  <button className="px-2 py-1 bg-gray-600 text-gray-100 rounded-sm hover:bg-gray-500">Search</button>
               </div>
            </form>
            <h3 className="pt-2 font-semibold">Orders</h3>
            {orderContent}
         </div>
      </KrakenLayout>
   )
}
