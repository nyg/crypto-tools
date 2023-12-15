import { useEffect, useState } from 'react'
import useSWRMutation from 'swr/mutation'
import Layout from '../components/lib/layout'
import Input from '../components/lib/input'


const priceFunctions = {
   'linear': (x, a, b, n) => (b - a) / (n - 1) * x + a
}

const volumeFunctions = {
   'linear': (totalVolume, orderCount) => totalVolume / orderCount
}

export default function Kraken() {

   const { data: createdOrders, error, isMutating, trigger: postScaledOrders } = useSWRMutation('/api/kraken/scaled-orders')

   const [ordersParams, setOrdersParams] = useState([])
   const [credentials, setCredentials] = useState({ apiKey: '', apiSecret: '' })
   useEffect(() =>
      setCredentials({
         apiKey: localStorage.getItem('kraken.api.key'),
         apiSecret: localStorage.getItem('kraken.api.secret')
      }), [])

   if (!credentials.apiKey) {
      return <div>Generate an API key and secret on Kraken to be able to fetch your spot and staking balance.</div>
   }


   const preview = () => {
      const formData = new FormData(document.getElementById('order-form'))

      const orderCount = Number.parseInt(formData.get('order-count'))
      const priceFrom = Number.parseFloat(formData.get('price-from'))
      const priceTo = Number.parseFloat(formData.get('price-to'))
      const volume = Number.parseFloat(formData.get('volume'))

      const priceFunction = priceFunctions[formData.get('price-fn')]
      const volumeFunction = volumeFunctions[formData.get('volume-fn')]

      const orders = [...Array(orderCount).keys()].map(i => ({
         price: priceFunction(i, priceFrom, priceTo, orderCount).toFixed(1),
         volume: volumeFunction(volume, orderCount).toFixed(8)
      }))

      console.log(formData.get('dry-run') === 'on' ? true : false)

      setOrdersParams({
         pair: formData.get('pair'),
         direction: formData.get('direction'),
         dryRun: formData.get('dry-run') === 'on' ? true : false,
         orders
      })
   }

   const createOrders = () => {
      preview()
      postScaledOrders({ credentials, ordersParams })
   }

   return (
      <Layout name="Kraken">
         <div className="flex-grow text-sm space-y-6 tabular-nums">
            <form id="order-form" method="post" >
               <div className="px-3 space-y-4 w-1/5">
                  <Input name='pair' label='Pair' defaultValue='XBTUSD' />
                  <Input name='direction' label='Direction' defaultValue='sell' />

                  <Input name='price-from' label='Price from' defaultValue='110000' />
                  <Input name='price-to' label='Price to' defaultValue='125000' />

                  <Input name='volume' label='Volume' defaultValue='0.2' />

                  <Input name='order-count' label='# of orders' defaultValue='12' />
                  <Input name='price-fn' label='Price function' defaultValue='linear' />
                  <Input name='volume-fn' label='Volume function' defaultValue='linear' />

                  <Input name="dry-run" label="Dry run" type="checkbox" />

                  <div className="space-x-4">
                     <input className="px-2 py-1 bg-gray-600 text-gray-100 rounded hover:bg-gray-500" type="button" value="Preview" onClick={preview} />
                     <input className="px-2 py-1 bg-gray-600 text-gray-100 rounded hover:bg-gray-500" type="button" value="Create orders" onClick={createOrders} />
                  </div>
               </div>
            </form>
            <div className="px-3">
               {ordersParams.orders?.map(order =>
                  <p key={Math.random()}>{`${ordersParams.direction} ${order.volume} ${ordersParams.pair} @ ${order.price}`}</p>
               )}
            </div>
            <div className="px-3">
               {createdOrders?.map(order =>
                  <p key={Math.random()}>{JSON.stringify(order)}</p>
               )}
            </div>
         </div>
      </Layout>
   )
}
