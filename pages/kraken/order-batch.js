import { useEffect, useState } from 'react'
import useSWRMutation from 'swr/mutation'
import KrakenLayout from '../../components/kraken/kraken-layout'
import ExternalLink from '../../components/lib/external-link'
import useSWR from 'swr'
import OrderBatchPreview from '../../components/kraken/order-batch-preview'
import OrderBatchForm from '../../components/kraken/order-batch-params'


const priceFunctions = {
   'linear': (x, a, b, n) => (b - a) / (n - 1) * x + a
}

const volumeFunctions = {
   'linear-base': (totalVolume, orderCount, price, allPrices) => totalVolume / orderCount,
   'linear-quote': (totalVolume, orderCount, price, allPrices) => {
      // calculate total quote per order such that all orders have equal quote value
      const sumOfInversePrices = allPrices.reduce((sum, p) => sum + (1 / p), 0)
      const quotePerOrder = totalVolume / sumOfInversePrices
      return quotePerOrder / price
   }
}

const buildOrdersParams = (formValues) => {
   const orderCount = Number.parseInt(formValues.orderCount)
   const priceFrom = Number.parseFloat(formValues.priceFrom)
   const priceTo = Number.parseFloat(formValues.priceTo)
   const volume = Number.parseFloat(formValues.volume)

   const priceFunction = priceFunctions[formValues.priceFn]
   const volumeFunction = volumeFunctions[formValues.volumeFn]

   const prices = [...Array(orderCount).keys()].map(i =>
      priceFunction(i, priceFrom, priceTo, orderCount)
   )

   const orders = prices.map((price, i) => ({
      price: price.toFixed(1),
      volume: volumeFunction(volume, orderCount, price, prices).toFixed(8)
   }))

   return {
      pair: formValues.pair,
      direction: formValues.direction,
      dryRun: formValues.dryRun,
      orders
   }
}

const postLimitOrders = <ExternalLink href="https://support.kraken.com/hc/en-us/articles/203053246-Other-order-options" className="underline">
   post limit orders
</ExternalLink>

const maxOpenOrders = <ExternalLink href="https://support.kraken.com/hc/en-us/articles/209090607-Maximum-number-of-open-orders" className="underline">
   80 and 225 open orders
</ExternalLink>


export default function KrakenOrderBatch() {

   const { data: tradingPairs, isLoading } = useSWR('/api/kraken/trading-pairs')
   const { data: createdOrders, isMutating, trigger: createOrders } = useSWRMutation('/api/kraken/order-batch')

   const [ordersParams, setOrdersParams] = useState({})
   const [credentials, setCredentials] = useState({ apiKey: '', apiSecret: '' })
   const [formValues, setFormValues] = useState({
      pair: 'XBTUSD',
      direction: 'buy',
      priceFrom: '40219',
      priceTo: '59219',
      volume: '3.5',
      orderCount: '20',
      priceFn: 'linear',
      volumeFn: 'linear-quote',
      dryRun: true
   })

   useEffect(() => {
      const apiKey = localStorage.getItem('kraken.api.key')
      const apiSecret = localStorage.getItem('kraken.api.secret')
      setCredentials({ apiKey, apiSecret })
   }, [])

   const showPreview = () => {
      setOrdersParams(buildOrdersParams(formValues))
   }

   const showPreviewAndCreateOrders = () => {
      const params = buildOrdersParams(formValues)
      setOrdersParams(params)
      createOrders({ credentials, ordersParams: params })
   }

   if (!credentials.apiKey) {
      return <KrakenLayout name="Order Batch">
         <div className="text-sm">
            Generate an API key and secret on Kraken to be able to fetch your spot and staking balance.
         </div>
      </KrakenLayout>
   }

   return (
      <KrakenLayout name="Order Batch">
         <p className="mb-6 max-w-5xl text-justify text-sm">
            This tool allows you to easily create multiple orders for a given
            trading pair. The goal is to easily place multiple buy orders below
            the current price, or sell orders above the current price. Orders
            are {postLimitOrders} and the quote currency is used for fees.
            Kraken allows you to have between {maxOpenOrders} across all trading
            pairs depending on your verification level. Orders are created by
            batches of 15 (Kraken API limitation).
         </p>

         <div className="flex gap-8 text-sm tabular-nums">
            <OrderBatchForm
               formValues={formValues}
               setFormValues={setFormValues}
               tradingPairs={tradingPairs}
               isLoading={isLoading}
               onShowPreview={showPreview}
               onCreateOrders={showPreviewAndCreateOrders} />
            <OrderBatchPreview ordersParams={ordersParams} tradingPairs={tradingPairs} />
            <div>
               <h3 className="pb-2 font-semibold">API Response</h3>
               {isMutating ? <p>Loading…</p> : createdOrders?.map(order =>
                  <p key={order.descr?.order ?? order}>{JSON.stringify(order)}</p>
               )}
            </div>
         </div>
      </KrakenLayout>
   )
}
