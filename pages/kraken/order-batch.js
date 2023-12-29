import { useEffect, useState } from 'react'
import useSWRMutation from 'swr/mutation'
import KrakenLayout from '../../components/kraken/kraken-layout'
import Input from '../../components/lib/input'
import ExternalLink from '../../components/lib/external-link'


const priceFunctions = {
   'linear': (x, a, b, n) => (b - a) / (n - 1) * x + a
}

const volumeFunctions = {
   'linear': (totalVolume, orderCount) => totalVolume / orderCount
}

const buildOrdersParams = () => {
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

   return {
      pair: formData.get('pair'),
      direction: formData.get('direction'),
      dryRun: formData.get('dry-run') === 'on' ? true : false,
      orders
   }
}

export default function KrakenOrderBatch() {

   // const { data: tradingPairs, error: assetPairsError, isLoading } = useSWR('/api/kraken/trading-pairs')
   const { data: createdOrders, error, isMutating, trigger: createOrders } = useSWRMutation('/api/kraken/scaled-orders')

   const [ordersParams, setOrdersParams] = useState([])
   const [credentials, setCredentials] = useState({ apiKey: '', apiSecret: '' })
   useEffect(() =>
      setCredentials({
         apiKey: localStorage.getItem('kraken.api.key'),
         apiSecret: localStorage.getItem('kraken.api.secret')
      }), [])

   if (!credentials.apiKey) {
      return <KrakenLayout name="Order Batch">
         <div className="text-sm">
            Generate an API key and secret on Kraken to be able to fetch your spot and staking balance.
         </div>
      </KrakenLayout>
   }

   const showPreview = () => {
      setOrdersParams(buildOrdersParams())
   }

   const showPreviewAndCreateOrders = () => {
      showPreview()
      createOrders({ credentials, ordersParams: buildOrdersParams() })
   }

   const postLimitOrders = <ExternalLink href="https://support.kraken.com/hc/en-us/articles/203053246-Other-order-options" className="underline">
      post limit orders
   </ExternalLink>

   const maxOpenOrders = <ExternalLink href="https://support.kraken.com/hc/en-us/articles/209090607-Maximum-number-of-open-orders" className="underline">
      80 and 225 open orders
   </ExternalLink>

   return (
      <KrakenLayout name="Order Batch">
         <p className="mb-6 w-2/5 text-justify text-sm">
            This tool allows you to easily create multiple orders for a given
            trading pair. The goal is to be able to place buy orders below the
            current price, or sell orders above the current price. Orders are
            {postLimitOrders} and the quote currency is used for fees. Kraken
            allows you to have between {maxOpenOrders} per trading pairs
            depending on your verification level.
         </p>

         <div className="flex gap-8 text-sm tabular-nums border-0 border-blue-700">
            <div className="border-0 border-red-700">
               <h3 className="pb-2 font-semibold">Parameters</h3>
               <div className="space-y-2">
                  <form className="space-y-3 border-0 border-blue-700" id="order-form" method="post">
                     <Input name="pair" label="Pair" defaultValue="XBTUSD" />
                     <Input name="direction" label="Direction" defaultValue="sell" />
                     <Input name="price-from" label="Price from" defaultValue="110000" />
                     <Input name="price-to" label="Price to" defaultValue="125000" />
                     <Input name="volume" label="Volume" defaultValue="0.2" />
                     <Input name="order-count" label="# of orders" defaultValue="12" />
                     <Input name="price-fn" label="Price function" defaultValue="linear" />
                     <Input name="volume-fn" label="Volume function" defaultValue="linear" />
                     <Input name="dry-run" label="Dry run" type="checkbox" />
                  </form>
                  <div className="space-x-4">
                     <input className="px-2 py-1 bg-gray-600 text-gray-100 rounded hover:bg-gray-500" type="button" value="Show preview" onClick={showPreview} />
                     <input className="px-2 py-1 bg-gray-600 text-gray-100 rounded hover:bg-gray-500" type="button" value="Create orders" onClick={showPreviewAndCreateOrders} />
                  </div>
               </div>
            </div>
            <div className="border-0 border-black">
               <h3 className="pb-2 font-semibold">Preview</h3>
               {/* <p>{ordersParams.orders.length} orders, dry run: {ordersParams.dryRun.toString()}.</p> */}
               {ordersParams.orders?.map(order =>
                  <p key={Math.random()}>{`${ordersParams.direction} ${order.volume} ${ordersParams.pair} @ limit ${order.price}`}</p>
               )}
            </div>
            <div className="border-0 border-orange-700">
               <h3 className="pb-2 font-semibold">API Response</h3>
               {/* TODO error handling */}
               {isMutating ? <p>Loading…</p> : createdOrders?.map(order =>
                  <p key={Math.random()}>{JSON.stringify(order)}</p>
               )}
            </div>
         </div>
      </KrakenLayout>
   )
}
