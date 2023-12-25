import { useEffect, useState } from 'react'
import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import Layout from '../../components/lib/layout'
import Input from '../../components/lib/input'
import ExternalLink from '../../components/lib/external-link'



export default function KrakenClosedOrders() {

   const { data: orders, error, isMutating, trigger: getOrders } = useSWRMutation('/api/kraken/closed-orders')

   const [credentials, setCredentials] = useState({ apiKey: '', apiSecret: '' })
   useEffect(() =>
      setCredentials({
         apiKey: localStorage.getItem('kraken.api.key'),
         apiSecret: localStorage.getItem('kraken.api.secret')
      }), [])

   if (!credentials.apiKey) {
      return <Layout name="Kraken">
         <div className="text-sm">
            Generate an API key and secret on Kraken to be able to fetch closed orders.
         </div>
      </Layout>
   }

   const fetchOrders = event => {
      event.preventDefault()
      const formData = new FormData(event.target)
      const asset = formData.get('asset')
      const fromDate = new Date(formData.get('date-from')).getTime() / 1000
      const toDate = new Date(formData.get('date-to')).getTime() / 1000
      console.log(asset, fromDate, toDate)
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
         {orders.map(order => <p key={Math.random()}>{`${order.descr.order} vol exec: ${order.vol_exec} cost: ${order.cost}`}</p>)}
      </>
   }
   else {
      orderContent = <span>No orders</span>
   }


   return (
      <Layout name="Kraken">
         <div className="space-y-4 text-sm tabular-nums">
            <h3 className="font-semibold">Parameters</h3>
            <form onSubmit={fetchOrders}>
               <div className="flex items-end gap-4">
                  <Input name="asset" label="Asset" defaultValue="XBT" />
                  <Input name="date-from" label="From" defaultValue="2023-12-01T00:00:00Z" />
                  <Input name="date-to" label="To" defaultValue="2023-12-31T00:00:00Z" />
                  <button className="px-2 py-1 bg-gray-600 text-gray-100 rounded hover:bg-gray-500">Search</button>
               </div>
            </form>
            <h3 className="pb-2 font-semibold">Orders</h3>
            {orderContent}
         </div>
      </Layout>
   )
}
