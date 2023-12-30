import { useEffect, useState } from 'react'
import useSWRMutation from 'swr/mutation'
import CurrentPositions from '../../components/current-positions'
import NextRedemptions from '../../components/next-redemptions'
import BinanceLayout from '../../components/binance/binance-layout'


export default function BinanceStaking() {

   const { data, error, isMutating, trigger: fetchAggregatedBalance } = useSWRMutation('/api/aggregate-balance')
   const fetchDataButton = <button className="px-2 py-1 bg-gray-600 text-gray-100 rounded hover:bg-gray-500" onClick={() => fetchAggregatedBalance(credentials)}>
      Fetch data
   </button>

   const [credentials, setCredentials] = useState({ apiKey: '', apiSecret: '' })
   useEffect(() =>
      setCredentials({
         apiKey: localStorage.getItem('binance.api.key'),
         apiSecret: localStorage.getItem('binance.api.secret')
      }), [])

   let content
   if (error) {
      content = <>
         <div className="text-red-500">{error}</div>
         {fetchDataButton}
      </>
   }
   else if (isMutating) {
      content = <div>Fetching data…</div>
   }
   else if (!data && !credentials.apiKey) {
      content = <div>Generate an API key and secret on Binance to be able to fetch your spot and staking balance.</div>
   }
   else if (!data) {
      content = fetchDataButton
   }
   else {
      content = <>
         <NextRedemptions data={data} />
         <CurrentPositions data={data} />
      </>
   }

   return (
      <BinanceLayout name="Staking">
         <div className="flex-grow text-sm space-y-4 tabular-nums">
            {content}
         </div>
      </BinanceLayout>
   )
}
