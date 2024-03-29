export default function MarketService(apiAdapter) {

   this.fetchTradingPairs = async function () {
      return await apiAdapter.fetchTradingPairs()
   }

   this.createOrders = async function (ordersParams) {
      return await apiAdapter.createOrders(ordersParams)
   }

   this.fetchClosedOrders = async function (searchParams) {
      return await apiAdapter.fetchClosedOrders(searchParams)
   }

   this.fetchRates = async function (pairs) {
      return await apiAdapter.fetchRates(pairs)
   }

   this.fetchCandlestickData = async function (symbol, interval, startTime, endTime, limit) {
      return await apiAdapter.fetchCandlestickData(symbol, interval, startTime, endTime, limit)
   }
}
