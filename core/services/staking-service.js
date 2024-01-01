export default function StakingService(apiAdapter) {

   this.fetchStakingProducts = async function () {
      return await apiAdapter.fetchStakingProducts()
   }

   this.fetchStakingBalances = async function () {
      return await apiAdapter.fetchStakingBalances()
   }
}
