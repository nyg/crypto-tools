export default function MarketService(apiAdapter) {

   this.createOrders = async function (ordersParams) {
      return await apiAdapter.createOrders(ordersParams)
   }
}
