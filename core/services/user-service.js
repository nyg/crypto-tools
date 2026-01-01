export default function UserService(apiAdapter) {

   this.fetchBalances = async function () {
      return await apiAdapter.fetchBalances()
   }

   this.fetchAssets = async function (type) {
      return await apiAdapter.fetchAssets(type)
   }
}
