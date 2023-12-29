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
}
