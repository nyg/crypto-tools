export default function StakingService(apiAdapter) {

   this.fetchStakingProducts = async function () {
      return await apiAdapter.fetchStakingProducts()
   }
}
