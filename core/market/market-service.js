import BinanceConnection from '../../adapters/binance-api/connection.js'


export default function MarketService(apiKey, apiSecret) {

   const connection = new BinanceConnection(apiKey, apiSecret)


   this.fetchTradingPairs = async function () {
      const info = await connection.fetchExchangeInfo()
      return info
         .symbols
         .map(pair => ({
            base: pair.baseAsset,
            quote: pair.quoteAsset
         }))
   }

}
