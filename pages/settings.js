import { useEffect, useState } from 'react'
import Input from '../components/lib/input'
import Layout from '../components/layout'


export default function Settings() {

   const [apiKeys, setApiKeys] = useState({
      binance: { apiKey: '', apiSecret: '' },
      kraken: { apiKey: '', apiSecret: '' }
   })

   useEffect(() =>
      setApiKeys({
         binance: {
            apiKey: localStorage.getItem('binance.api.key') || process.env.NEXT_PUBLIC_BINANCE_API_KEY,
            apiSecret: localStorage.getItem('binance.api.secret') || process.env.NEXT_PUBLIC_BINANCE_API_SECRET
         },
         kraken: {
            apiKey: localStorage.getItem('kraken.api.key') || process.env.NEXT_PUBLIC_KRAKEN_API_KEY,
            apiSecret: localStorage.getItem('kraken.api.secret') || process.env.NEXT_PUBLIC_KRAKEN_API_SECRET
         }
      }), [])

   return (
      <Layout name="Settings">
         <div className="grow p-3 space-y-4 text-sm">
            <h2 className="text-base font-semibold">API Keys</h2>

            <h3>Binance</h3>
            <form method="post" onSubmit={event => saveApiKeys(event, 'binance')}>
               <div className="flex items-end gap-x-3">
                  <Input className="grow" name="binance-api-key" label="API Key" defaultValue={apiKeys.binance.apiKey} />
                  <Input className="grow" name="binance-api-secret" label="API Secret" defaultValue={apiKeys.binance.apiSecret} type="password" />
                  <button className="px-2 py-1 bg-gray-600 text-gray-100 rounded-sm hover:bg-gray-500">Save</button>
               </div>
            </form>

            <h3>Kraken</h3>
            <form method="post" onSubmit={event => saveApiKeys(event, 'kraken')}>
               <div className="flex items-end gap-x-3">
                  <Input className="grow" name="kraken-api-key" label="API Key" defaultValue={apiKeys.kraken.apiKey} />
                  <Input className="grow" name="kraken-api-secret" label="API Secret" defaultValue={apiKeys.kraken.apiSecret} type="password" />
                  <button className="px-2 py-1 bg-gray-600 text-gray-100 rounded-sm">Save</button>
               </div>
            </form>
         </div>
      </Layout>
   )
}

const saveApiKeys = (event, exchange) => {
   event.preventDefault()

   const formData = new FormData(event.target)
   localStorage.setItem(`${exchange}.api.key`, formData.get(`${exchange}-api-key`))
   localStorage.setItem(`${exchange}.api.secret`, formData.get(`${exchange}-api-secret`))

   const button = event.target.getElementsByTagName('button')[0]
   button.textContent = 'Saved!'
   setTimeout(() => button.textContent = 'Save', 1500)
}
