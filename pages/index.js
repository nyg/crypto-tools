import { useEffect, useState } from 'react'
import Head from 'next/head'
import useSWRMutation from 'swr/mutation'
import CurrentPositions from '../components/current-positions'
import Menu from '../components/menu'
import NextRedemptions from '../components/next-redemptions'


export default function Home() {

   const { data, error, trigger, isMutating } = useSWRMutation('/api/aggregate-balance', sendRequest)

   const [apiKeys, setApiKeys] = useState({ apiKey: '', apiSecret: '' })
   useEffect(() =>
      setApiKeys({
         apiKey: localStorage.getItem('binance.api.key'),
         apiSecret: localStorage.getItem('binance.api.secret')
      }), [])

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
      <div>
         <Head>
            <title>Crypto Tools — Binance</title>
            <meta name="description" content="Crypto Tools" />
            <link rel="icon" href="/favicon.ico" />
         </Head>

         <main className="flex flex-col px-12 pb-12">
            <header className="px-3 pb-2 my-4 flex items-baseline gap-x-3 border-b">
               <h1 className="text-xl">Crypto Tools</h1>
               <span className="flex-grow"></span>
               <Menu />
            </header>

            <section className="flex-grow text-sm space-y-6 tabular-nums">
               <div className="px-3 space-y-4">
                  {content}
               </div>
            </section>
         </main>
      </div>
   )
}

async function sendRequest(url, params) {
   // to check for error handling:
   // https://github.com/ElvenTools/elven-tools-dapp/blob/85013df2eacac974804c345434c432447c112f64/utils/apiCall.ts
   return (await fetch(url, { method: 'POST', body: JSON.stringify(params.arg), headers: { 'Content-Type': 'application/json' } })).json()
}
