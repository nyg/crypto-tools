import { useState } from 'react'
import { toast } from 'sonner'
import Input from '../components/lib/input'
import InfoBanner from '../components/lib/info-banner'
import Layout from '../components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

const providers = [
   {
      id: 'binance',
      name: 'Binance',
      description: 'Reads your staking positions and balances. Read-only permissions are enough.',
      hasSecret: true,
      envKey: import.meta.env.VITE_BINANCE_API_KEY,
      envSecret: import.meta.env.VITE_BINANCE_API_SECRET
   },
   {
      id: 'kraken',
      name: 'Kraken',
      description: 'Syncs your ledger and trade history, and creates orders. The secret is only sent for private calls.',
      hasSecret: true,
      envKey: import.meta.env.VITE_KRAKEN_API_KEY,
      envSecret: import.meta.env.VITE_KRAKEN_API_SECRET
   },
   {
      id: 'anthropic',
      name: 'Anthropic',
      description: 'Writes the xStocks summaries. Usage is billed to your own Anthropic account.',
      hasSecret: false,
      envKey: import.meta.env.VITE_ANTHROPIC_API_KEY
   }
]

const storedCredentials = provider => ({
   apiKey: (typeof window !== 'undefined' && localStorage.getItem(`${provider.id}.api.key`))
      || provider.envKey
      || '',
   apiSecret: provider.hasSecret
      ? (typeof window !== 'undefined' && localStorage.getItem(`${provider.id}.api.secret`))
         || provider.envSecret
         || ''
      : ''
})

const saveApiKeys = (event, provider) => {
   event.preventDefault()

   const formData = new FormData(event.target)
   localStorage.setItem(`${provider.id}.api.key`, formData.get(`${provider.id}-api-key`))

   if (provider.hasSecret) {
      localStorage.setItem(`${provider.id}.api.secret`, formData.get(`${provider.id}-api-secret`))
   }

   toast.success(`${provider.name} API key saved`)
}


export default function Settings() {

   const [credentials] = useState(() =>
      Object.fromEntries(providers.map(provider => [provider.id, storedCredentials(provider)])))

   return (
      <Layout name="Settings">
         <div className="space-y-6">

            <InfoBanner>
               The keys the other pages use to reach each exchange. They are kept in this
               browser&apos;s local storage on this machine, never uploaded anywhere, and sent to
               the local server only to sign the calls a page makes on your behalf. Removing a key
               here is enough to cut a page off from its exchange.
            </InfoBanner>

            {providers.map(provider =>
               <Card key={provider.id} size="sm">
                  <CardHeader>
                     <CardTitle>{provider.name}</CardTitle>
                     <CardDescription>{provider.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                     <form method="post" onSubmit={event => saveApiKeys(event, provider)} className="space-y-4">
                        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                           <Input
                              name={`${provider.id}-api-key`}
                              label="API Key"
                              defaultValue={credentials[provider.id].apiKey} />
                           {provider.hasSecret &&
                              <Input
                                 name={`${provider.id}-api-secret`}
                                 label="API Secret"
                                 type="password"
                                 defaultValue={credentials[provider.id].apiSecret} />}
                        </div>
                        <Button type="submit" size="sm">Save</Button>
                     </form>
                  </CardContent>
               </Card>
            )}

         </div>
      </Layout>
   )
}
