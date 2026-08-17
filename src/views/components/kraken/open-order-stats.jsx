import Big from 'big.js'
import Field from '../lib/field'
import { asAssetAmount, asNumber } from '../../../utils/format'

export function summarize(orders) {

   const volume = orders.reduce((sum, order) => sum.plus(order.remaining), Big(0))
   const value = orders.reduce((sum, order) => sum.plus(order.value), Big(0))
   const prices = orders.map(order => Big(order.price))

   return {
      count: orders.length,
      buys: orders.filter(order => order.type === 'buy').length,
      sells: orders.filter(order => order.type === 'sell').length,
      volume,
      value,
      averagePrice: volume.eq(0) ? null : value.div(volume),
      lowestPrice: prices.length === 0 ? null : prices.reduce((low, price) => price.lt(low) ? price : low),
      highestPrice: prices.length === 0 ? null : prices.reduce((high, price) => price.gt(high) ? price : high)
   }
}

export default function OpenOrderStats({ orders, baseAsset, quoteAsset, lastPrice }) {

   const stats = summarize(orders)

   const amount = (value, asset) => `${asAssetAmount(Number(value))} ${asset}`

   return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
         <Field label="Orders" title={`${stats.buys} buy, ${stats.sells} sell`}>
            {asNumber(stats.count)}
            <span className="ml-2 text-xs text-muted-foreground">
               {stats.buys} buy · {stats.sells} sell
            </span>
         </Field>
         <Field label="Volume" title={`${stats.volume.toFixed()} ${baseAsset}`}>
            {amount(stats.volume, baseAsset)}
         </Field>
         <Field label="Cost" title={`${stats.value.toFixed()} ${quoteAsset}`}>
            {amount(stats.value, quoteAsset)}
         </Field>
         <Field label="Average price" title="Weighted by volume">
            {stats.averagePrice ? amount(stats.averagePrice, quoteAsset) : '—'}
         </Field>
         <Field label="Price range">
            {stats.lowestPrice
               ? `${asAssetAmount(Number(stats.lowestPrice))} – ${asAssetAmount(Number(stats.highestPrice))}`
               : '—'}
         </Field>
         <Field label="Last traded" title={lastPrice == null ? 'Kraken has no ticker for this pair' : undefined}>
            {lastPrice == null ? '—' : amount(lastPrice, quoteAsset)}
         </Field>
      </div>
   )
}
