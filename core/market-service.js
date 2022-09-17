import { binanceConnection } from '../adapters/binance-api/connection'


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
}

export const marketService = new MarketService()
