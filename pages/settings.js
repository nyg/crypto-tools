import { useEffect, useState } from 'react'
import Head from 'next/head'
import Menu from '../components/menu'
import Input from '../components/lib/input'


export default function Settings() {

   const [apiKeys, setApiKeys] = useState({ binance: { apiKey: '', apiSecret: '' } })

   useEffect(() =>
      setApiKeys({
         binance: {
            apiKey: localStorage.getItem('binance.api.key') || process.env.NEXT_PUBLIC_BINANCE_API_KEY,
            apiSecret: localStorage.getItem('binance.api.secret') || process.env.NEXT_PUBLIC_BINANCE_API_SECRET
         }
      }), [])

   return (
      <div>
         <Head>
            <title>Crypto Tools — Settings</title>
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
                  <h2>API Keys</h2>

                  <h3>Binance</h3>
                  <form method="post" onSubmit={event => saveApiKeys(event, 'binance')}>
                     <div className="flex items-end gap-x-3">
                        <Input className="flex-grow" name="apiKey" label="API Key" defaultValue={apiKeys.binance.apiKey} />
                        <Input className="flex-grow" name="apiSecret" label="API Secret" defaultValue={apiKeys.binance.apiSecret} type="password" />
                        <button className="px-2 py-1 bg-gray-600 text-gray-100 rounded hover:bg-gray-500">Save</button>
                     </div>
                  </form>
               </div>
            </section>
         </main>
      </div>

   )
}

const saveApiKeys = (event, exchange) => {
   event.preventDefault()
   const formData = new FormData(event.target)
   localStorage.setItem(`${exchange}.api.key`, formData.get('apiKey'))
   localStorage.setItem(`${exchange}.api.secret`, formData.get('apiSecret'))
}
