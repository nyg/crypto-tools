import { useSWRConfig } from 'swr'
import useSWRMutation from 'swr/mutation'
import { toast } from 'sonner'
import Input from '../components/lib/input'
import InfoBanner from '../components/lib/info-banner'
import Layout from '../components/layout'
import useSettings, { SETTINGS_KEY, SETTINGS_REVEAL_KEY } from '../lib/use-settings'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

const providers = [
   {
      id: 'binance',
      name: 'Binance',
      description: 'Reads your staking positions and balances. Read-only permissions are enough.',
      hasSecret: true
   },
   {
      id: 'kraken',
      name: 'Kraken',
      description: 'Syncs your ledger and trade history, and creates orders. The secret is only sent for private calls.',
      hasSecret: true
   },
   {
      id: 'anthropic',
      name: 'Anthropic',
      description: 'Writes the xStocks summaries. Usage is billed to your own Anthropic account.',
      hasSecret: false
   }
]


const storeNames = {
   keychain: 'the macOS Keychain',
   'credential-manager': 'the Windows Credential Manager',
   file: 'the app’s own data folder, beside the ledger database'
}

const storeOrder = ['keychain', 'credential-manager', 'file']

export default function Settings() {

   // The only place that asks for the keys themselves, to prefill the form.
   const { settings, isLoading, mutate } = useSettings(SETTINGS_REVEAL_KEY)
   const { trigger: saveSettings, isMutating } = useSWRMutation(SETTINGS_KEY)
   const { mutate: globalMutate } = useSWRConfig()

   const locations = storeOrder
      .filter(store => providers.some(provider => {
         const stored = settings?.[provider.id]
         return stored?.keyConfigured && stored.source === store
      }))
      .map(store => storeNames[store])

   const destination = storeNames[settings?.secretStore] ?? storeNames.file

   const whereTheyLive = locations.length > 0
      ? `They are stored on this machine in ${locations.join(' and ')}`
      : `A key saved here is stored on this machine in ${destination}`

   const noteFor = stored => stored?.unreadable === 'store-unavailable'
      ? ` Its key is in the OS credential store, which this session cannot reach — saving here writes the new value to ${storeNames.file} instead.`
      : stored?.unreadable
         ? ` Its key could not be read from ${storeNames[stored.source] ?? 'the credential store'} just now, so the fields below are blank. The entry itself is untouched — retry once access is granted, or type both values to replace it.`
         : ''

   const save = async (event, provider) => {
      event.preventDefault()

      const formData = new FormData(event.target)
      const update = { apiKey: formData.get(`${provider.id}-api-key`) }

      if (provider.hasSecret) {
         update.apiSecret = formData.get(`${provider.id}-api-secret`)
      }

      try {
         await saveSettings({ [provider.id]: update })
         // Both keys: this page's revealed copy, and the booleans every other page reads.
         await Promise.all([mutate(), globalMutate(SETTINGS_KEY)])
         toast.success(`${provider.name} API key saved`)
      }
      catch (error) {
         toast.error(String(error))
      }
   }

   return (
      <Layout name="Settings">
         <div className="space-y-6">

            <InfoBanner>
               The keys the other pages use to reach each exchange. {whereTheyLive},
               never uploaded anywhere, and used only to sign the calls a page makes on your behalf.
               Removing a key here is enough to cut a page off from its exchange.
            </InfoBanner>

            {providers.map(provider => {
               const stored = settings?.[provider.id]
               const fromEnvironment = stored?.source === 'env'
               const mustRetype = stored?.unreadable === 'read-failed'

               return (
                  <Card key={provider.id} size="sm">
                     <CardHeader>
                        <CardTitle>{provider.name}</CardTitle>
                        <CardDescription>
                           {provider.description}
                           {fromEnvironment && ' Currently provided by an environment variable, which takes precedence over anything saved here.'}
                           {noteFor(stored)}
                        </CardDescription>
                     </CardHeader>
                     <CardContent>
                        <form method="post" onSubmit={event => save(event, provider)} className="space-y-4">
                           <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                              <Input
                                 key={`${provider.id}-key-${stored?.apiKey ?? ''}`}
                                 name={`${provider.id}-api-key`}
                                 label="API Key"
                                 disabled={isLoading}
                                 required={mustRetype}
                                 defaultValue={stored?.apiKey ?? ''} />
                              {provider.hasSecret &&
                                 <Input
                                    key={`${provider.id}-secret-${stored?.apiSecret ?? ''}`}
                                    name={`${provider.id}-api-secret`}
                                    label="API Secret"
                                    type="password"
                                    disabled={isLoading}
                                    required={mustRetype}
                                    defaultValue={stored?.apiSecret ?? ''} />}
                           </div>
                           <Button type="submit" size="sm" disabled={isLoading || isMutating}>Save</Button>
                        </form>
                     </CardContent>
                  </Card>
               )
            })}

         </div>
      </Layout>
   )
}
