import { useEffect, useState } from 'react'
import CurrentPositions from '../components/current-positions'
import NextRedemptions from '../components/next-redemptions'
import Layout from '../components/lib/layout'
import getAggregateBalance from '../core/facades/aggregate-balance'


const useFacade = facade => {

   const [data, setData] = useState(null)
   const [loading, setLoading] = useState(false)
   const [error, setError] = useState(null)

   const trigger = async args => {
      try {
         setLoading(true)
         const response = await facade(args)
         console.log('fetched response of facade hook')
         setData(response)
         setLoading(false)
      }
      catch (error) {
         console.log('error during facade hook call')
         setError(error)
         setLoading(false)
      }
   }

   return {
      data, loading, error, trigger
   }
}

// const p1 = fetch(url, options)
// const p2 = fetch(url, options)
// const res = await Promise.all([p1, p2])
// const formatted = format(res)
// store(formatted) // if set state then would rerender auto but we want to store in browser db?

export default function Home() {

   const [credentials, setCredentials] = useState({ apiKey: '', apiSecret: '' })
   useEffect(() =>
      setCredentials({
         apiKey: localStorage.getItem('binance.api.key'),
         apiSecret: localStorage.getItem('binance.api.secret')
      }), [])


   const { data, loading, error, trigger } = useFacade(getAggregateBalance)

   let content
   if (error) {
      content = <div className="text-red-500">{error}</div>
   }
   else if (loading) {
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
