import { useEffect, useState } from 'react'
import useSWRMutation from 'swr/mutation'
import KrakenLayout from '../../components/kraken/kraken-layout'


export default function KrakenBalance() {

   const { data, error, trigger, isMutating } = useSWRMutation('/api/kraken/balances')

   const [credentials, setCredentials] = useState({ apiKey: '', apiSecret: '' })
   useEffect(() =>
      setCredentials({
         apiKey: localStorage.getItem('kraken.api.key'),
         apiSecret: localStorage.getItem('kraken.api.secret')
      }), [])

   let content
   if (error) {
      content = <div className="text-red-500">{error}</div>
   }
   else if (isMutating) {
      content = <div>Fetching data…</div>
   }
   else if (!data && !credentials.apiKey) {
      content = <div>Generate an API key and secret on Kraken to be able to fetch your spot and staking balance.</div>
   }
   else if (!data) {
      content = <button className="px-2 py-1 bg-gray-600 text-gray-100 rounded hover:bg-gray-500" onClick={() => trigger(credentials)}>
         Fetch data
      </button>
   }
   else {
      console.log(data)
      content = <>
         <p>Done!</p>
      </>
   }

   return (
      <KrakenLayout name="Balance">
         <div className="flex-grow text-sm space-y-6 tabular-nums">
            <div className="px-3 space-y-4">
               {content}
            </div>
         </div>
      </KrakenLayout>
   )
}
