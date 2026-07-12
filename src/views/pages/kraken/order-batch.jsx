import { useState } from 'react'
import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import Big from 'big.js'
import { Loader2Icon, InfoIcon } from 'lucide-react'
import KrakenLayout from '../../components/kraken/kraken-layout'
import ExternalLink from '../../components/lib/external-link'
import OrderBatchForm from '../../components/kraken/order-batch-params'
import OrderBatchTable from '../../components/kraken/order-batch-table'
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'


const priceFunctions = {
   'linear': (x, a, b, n) => Big(b).minus(a).div(Big(n).minus(1)).times(x).plus(a)
}

const volumeFunctions = {
   'linear-base': (totalVolume, orderCount, price, allPrices) => totalVolume.div(orderCount),
   'linear-quote': (totalVolume, orderCount, price, allPrices) => {
      // calculate total quote per order such that all orders have equal quote value
      const sumOfInversePrices = allPrices.reduce((sum, p) => sum.plus(Big(1).div(p)), Big(0))
      const quotePerOrder = totalVolume.div(sumOfInversePrices)
      return quotePerOrder.div(price)
   }
}

const buildOrdersParams = (formValues, dryRun) => {
   const orderCount = Number.parseInt(formValues.orderCount)
   const priceFrom = Big(formValues.priceFrom)
   const priceTo = Big(formValues.priceTo)
   const volume = Big(formValues.volume)

   const priceFunction = priceFunctions[formValues.priceFn]
   const volumeFunction = volumeFunctions[formValues.volumeFn]

   const prices = [...Array(orderCount).keys()].map(i =>
      priceFunction(i, priceFrom, priceTo, orderCount)
   )

   const orders = prices.map((price) => ({
      price,
      volume: volumeFunction(volume, orderCount, price, prices)
   }))

   return {
      pair: formValues.pair,
      direction: formValues.direction,
      dryRun,
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
   const { data: createdOrders, isMutating, error, trigger: createOrders, reset } = useSWRMutation('/api/kraken/order-batch')

   const [ordersParams, setOrdersParams] = useState({})
   const [submittedMode, setSubmittedMode] = useState(null)
   const [credentials] = useState(() => ({
      apiKey: (typeof window !== 'undefined' && localStorage.getItem('kraken.api.key')) || '',
      apiSecret: (typeof window !== 'undefined' && localStorage.getItem('kraken.api.secret')) || ''
   }))
   const [formValues, setFormValues] = useState({
      pair: 'XBTUSD',
      direction: 'buy',
      priceFrom: '40219',
      priceTo: '59219',
      volume: '3.5',
      orderCount: '20',
      priceFn: 'linear',
      volumeFn: 'linear-quote'
   })

   const showPreview = () => {
      setOrdersParams(buildOrdersParams(formValues))
      setSubmittedMode(null)
      reset()
   }

   const createOrdersWith = (dryRun, mode) => {
      const params = buildOrdersParams(formValues, dryRun)
      setOrdersParams(params)
      setSubmittedMode(mode)
      reset()
      createOrders({ credentials, ordersParams: params }).catch(() => {})
   }

   if (!credentials.apiKey) {
      return (
         <KrakenLayout name="Order Batch">
            <Alert>
               <AlertDescription>
                  Generate an API key and secret on Kraken and add them in Settings to create orders.
               </AlertDescription>
            </Alert>
         </KrakenLayout>
      )
   }

   let statusIndicator
   if (isMutating) {
      statusIndicator = (
         <span className="flex items-center gap-1.5 text-sm font-normal text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            {submittedMode === 'live' ? 'Creating orders…' : 'Validating…'}
         </span>
      )
   }
   else if (createdOrders?.some(order => order?.txid)) {
      statusIndicator = <Badge>Orders created</Badge>
   }
   else if (createdOrders?.length > 0) {
      statusIndicator = <Badge variant="secondary">Dry run · validated</Badge>
   }
   else if (ordersParams.orders?.length > 0) {
      statusIndicator = <Badge variant="outline">Preview</Badge>
   }

   return (
      <KrakenLayout name="Order Batch">
         <div className="space-y-6">
            <Alert>
               <InfoIcon />
               <AlertDescription>
                  Create multiple limit orders for a trading pair in one go — for example a ladder of
                  buy orders below the current price, or sell orders above it. Orders are {postLimitOrders} and
                  the quote currency is used for fees. Depending on your verification level Kraken allows
                  between {maxOpenOrders} across all pairs. Orders are sent in batches of 15 (Kraken API limit).
               </AlertDescription>
            </Alert>

            <Card>
               <CardHeader>
                  <CardTitle>Parameters</CardTitle>
               </CardHeader>
               <CardContent>
                  <OrderBatchForm
                     formValues={formValues}
                     setFormValues={setFormValues}
                     tradingPairs={tradingPairs}
                     isLoading={isLoading}
                     onShowPreview={showPreview}
                     onCreateDryRun={() => createOrdersWith(true, 'dry-run')}
                     onCreateLive={() => createOrdersWith(false, 'live')} />
               </CardContent>
            </Card>

            <Card>
               <CardHeader>
                  <CardTitle>Orders</CardTitle>
                  {statusIndicator && <CardAction>{statusIndicator}</CardAction>}
               </CardHeader>
               <CardContent className="space-y-3">
                  {error &&
                     <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                  <OrderBatchTable
                     ordersParams={ordersParams}
                     tradingPairs={tradingPairs}
                     createdOrders={createdOrders} />
               </CardContent>
            </Card>
         </div>
      </KrakenLayout>
   )
}
