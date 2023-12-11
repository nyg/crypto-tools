import { useEffect, useState } from 'react'
import useSWRMutation from 'swr/mutation'
import CurrentPositions from '../components/current-positions'
import NextRedemptions from '../components/next-redemptions'
import Layout from '../components/lib/layout'


export default function Binance() {

   const { data, error, trigger, isMutating } = useSWRMutation('/api/aggregate-balance')

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
         <button className="px-2 py-1 bg-gray-600 text-gray-100 rounded hover:bg-gray-500" onClick={() => trigger(credentials)}>
            Fetch data
         </button>
      </>
   }
   else if (isMutating) {
      content = <div>Fetching data…</div>
   }
   else if (!data && !credentials.apiKey) {
      content = <div>Generate an API key and secret on Binance to be able to fetch your spot and staking balance.</div>
   }
   else if (!data) {
      content = <button className="px-2 py-1 bg-gray-600 text-gray-100 rounded hover:bg-gray-500" onClick={() => trigger(credentials)}>
         Fetch data
      </button>
   }
   else {
      content = <>
         <NextRedemptions data={data} />
         <CurrentPositions data={data} />
      </>
   }

   return (
      <Layout name="Binance">
         <section className="flex-grow text-sm space-y-6 tabular-nums">
            <div className="px-3 space-y-4">
               {content}
            </div>
         </section>
      </Layout>
   )
}
