export default function FundingService(apiAdapter) {

   this.fetchFiatDeposits = async function (fromDate, toDate) {
      return await apiAdapter.fetchFiatDeposits(fromDate, toDate)
   }
}
