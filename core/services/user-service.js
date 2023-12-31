export default function UserService(apiAdapter) {

   this.fetchBalances = async function () {
      return await apiAdapter.fetchBalances()
   }
}
