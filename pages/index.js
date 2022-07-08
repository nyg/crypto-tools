import ApiForm from '../components/api-form'
import CurrentPositions from '../components/current-positions'
import eventBus from '../utils/event-bus'
import Head from 'next/head'
import Menu from '../components/menu'
import NextRedemptions from '../components/next-redemptions'
import { useEffect } from 'react'
import useSWRMutation from 'swr/mutation'


export default function Home() {

   const { data, error, trigger, isMutating } = useSWRMutation('/api/aggregate-balance', sendRequest)
   useEffect(() => eventBus.on('api.form.submitted', trigger), [])

   let content
   if (error) {
      content = <div className="text-red-500">{error}</div>
   }
   else if (isMutating) {
      content = <div>Fetching data…</div>
   }
   else if (!data) {
      content = <div>Generate an API key and secret on Binance to be able to fetch your spot and staking balance.</div>
   }
   else {
      console.log(data)
      content = (
         <>
            <NextRedemptions data={data} />
            <CurrentPositions data={data} />
         </>
      )
   }

   return (
      <div>
         <Head>
            <title>Binance Staking Overview</title>
            <meta name="description" content="Binance Staking Overview" />
            <link rel="icon" href="/favicon.ico" />
         </Head>

         <main className="flex flex-col px-12 pb-12">
            <header className="px-3 pb-2 my-4 flex items-baseline gap-x-3 border-b">
               <h1 className="text-xl">Binance Staking Overview</h1>
               <span className="flex-grow"></span>
               <Menu />
            </header>

            <section className="flex-grow text-sm space-y-6">
               <ApiForm />

               <div className="px-3 space-y-4">
                  {content}
               </div>
            </section>
         </main>
      </div>
   )
}

async function sendRequest(url, { arg: body }) {
   // to check for error handling:
   // https://github.com/ElvenTools/elven-tools-dapp/blob/85013df2eacac974804c345434c432447c112f64/utils/apiCall.ts
   return (await fetch(url, { method: 'POST', body })).json()
}
