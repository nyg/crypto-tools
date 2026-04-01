import { useState } from 'react'
import Input from '../components/lib/input'
import Layout from '../components/layout'
import { Button } from '@/components/ui/button'


export default function Settings() {

   const [apiKeys, setApiKeys] = useState(() => ({
      binance: {
         apiKey: (typeof window !== 'undefined' && localStorage.getItem('binance.api.key')) || process.env.NEXT_PUBLIC_BINANCE_API_KEY || '',
         apiSecret: (typeof window !== 'undefined' && localStorage.getItem('binance.api.secret')) || process.env.NEXT_PUBLIC_BINANCE_API_SECRET || ''
      },
      kraken: {
         apiKey: (typeof window !== 'undefined' && localStorage.getItem('kraken.api.key')) || process.env.NEXT_PUBLIC_KRAKEN_API_KEY || '',
         apiSecret: (typeof window !== 'undefined' && localStorage.getItem('kraken.api.secret')) || process.env.NEXT_PUBLIC_KRAKEN_API_SECRET || ''
      },
      anthropic: {
         apiKey: (typeof window !== 'undefined' && localStorage.getItem('anthropic.api.key')) || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''
      }
   }))

   return (
      <Layout name="Settings">
         <div className="grow p-3 space-y-4 text-sm">
            <h2 className="text-base font-semibold">API Keys</h2>

            <h3>Binance</h3>
            <form method="post" onSubmit={event => saveApiKeys(event, 'binance')}>
               <div className="flex items-end gap-x-3">
                  <Input className="grow" name="binance-api-key" label="API Key" defaultValue={apiKeys.binance.apiKey} />
                  <Input className="grow" name="binance-api-secret" label="API Secret" defaultValue={apiKeys.binance.apiSecret} type="password" />
                  <Button type="submit" size="sm">Save</Button>
               </div>
            </form>

            <h3>Kraken</h3>
            <form method="post" onSubmit={event => saveApiKeys(event, 'kraken')}>
               <div className="flex items-end gap-x-3">
                  <Input className="grow" name="kraken-api-key" label="API Key" defaultValue={apiKeys.kraken.apiKey} />
                  <Input className="grow" name="kraken-api-secret" label="API Secret" defaultValue={apiKeys.kraken.apiSecret} type="password" />
                  <Button type="submit" size="sm">Save</Button>
               </div>
            </form>

            <h3>Anthropic</h3>
            <form method="post" onSubmit={event => saveApiKeys(event, 'anthropic')}>
               <div className="flex items-end gap-x-3">
                  <Input className="grow" name="anthropic-api-key" label="API Key" defaultValue={apiKeys.anthropic.apiKey} />
                  <Button type="submit" size="sm">Save</Button>
               </div>
            </form>
         </div>
      </Layout>
   )
}

const saveApiKeys = (event, provider) => {
   event.preventDefault()

   const formData = new FormData(event.target)
   localStorage.setItem(`${provider}.api.key`, formData.get(`${provider}-api-key`))
   localStorage.setItem(`${provider}.api.secret`, formData.get(`${provider}-api-secret`))

   const button = event.target.getElementsByTagName('button')[0]
   button.textContent = 'Saved!'
   setTimeout(() => button.textContent = 'Save', 1500)
}
