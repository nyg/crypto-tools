import { binanceConnection } from '../../adapters/binance-api/connection'
import { krakenResource } from '../../adapters/kraken-api/resource'

function MarketService() {

   this.fetchTradingPairs = async function () {
      const info = await binanceConnection.fetchExchangeInfo()
      return info
         .symbols
         .map(pair => ({
            base: pair.baseAsset,
            quote: pair.quoteAsset
         }))
   }

   this.fetchEOYRates = async function (assets, referenceAsset) {

      const rates = {}
      for (const asset of assets) {
         const assetPair = `${asset}${referenceAsset}`
         const startTime = new Date('2022-12-31').getTime()
         const endTime = new Date('2023-01-01').getTime() - 1
         console.log('Fetching EOY rate for', asset)
         try {
            const resp = await binanceConnection.fetchKLines(assetPair, '1d', startTime, endTime, 1)
            // await new Promise(r => setTimeout(r, 1000))
            rates[asset] = resp[0]?.[4] ?? undefined
         }
         catch {
            rates[asset] = undefined
         }
      }

      return rates
   }

   this.createOrders = async function ({ pair, direction, orderParams }) {

      krakenResource.createOrders
   }
}

export const marketService = new MarketService()
