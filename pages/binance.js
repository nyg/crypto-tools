import { useEffect, useState } from 'react'
import useSWRMutation from 'swr/mutation'
import CurrentPositions from '../components/current-positions'
import NextRedemptions from '../components/next-redemptions'
import Layout from '../components/lib/layout'


export default function Home() {

   const [apiKeys, setApiKeys] = useState({ apiKey: '', apiSecret: '' })
   useEffect(() =>
      setApiKeys({
         apiKey: localStorage.getItem('binance.api.key'),
         apiSecret: localStorage.getItem('binance.api.secret')
      }), [])

   const fetchAPIData = async () =>  {

      // TODO this service is specific to Binance, logic probably needs to be moved adapter somehow
      const spotBalance = await spotService.fetchSpotBalance(apiKeys)
      const stakingPositions = await stakingService.fetchStakingBalance(apiKeys)
      const stakingProducts = await stakingService.fetchStakingProducts()


      const p1 = fetch(url, options)
      const p2 = fetch(url, options)
      const res = await Promise.all([p1, p2])
      const formatted = format(res)
      store(formatted) // if set state then would rerender auto but we want to store in browser db?
   }



   // faire un hook qui useApi(apiUrls, presenter)

   const { data, error, trigger, isMutating } = useSWRMutation('/api/aggregate-balance', sendRequest)


   let content
   if (error) {
      content = <div className="text-red-500">{error}</div>
   }
   else if (isMutating) {
      content = <div>Fetching data…</div>
   }
   else if (!data && !apiKeys.apiKey) {
      content = <div>Generate an API key and secret on Binance to be able to fetch your spot and staking balance.</div>
   }
   else if (!data) {
      content = <button className="px-2 py-1 bg-gray-600 text-gray-100 rounded hover:bg-gray-500" onClick={() => trigger(apiKeys)}>
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

async function sendRequest(url, params) {
   // to check for error handling:
   // https://github.com/ElvenTools/elven-tools-dapp/blob/85013df2eacac974804c345434c432447c112f64/utils/apiCall.ts
   return (await fetch(url, { method: 'POST', body: JSON.stringify(params.arg), headers: { 'Content-Type': 'application/json' } })).json()
}
