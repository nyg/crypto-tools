import { useState } from 'react'
import type { ComponentType, FormEvent, ReactNode } from 'react'
import { useSWRConfig } from 'swr'
import { toast } from 'sonner'
import { CheckIcon, ShieldCheckIcon } from 'lucide-react'
import useMutation from '../../lib/use-mutation'
import useSettings, { SETTINGS_KEY, SETTINGS_REVEAL_KEY } from '../../lib/use-settings'
import { messageOf } from '../../lib/errors'
import Input from '../lib/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import type { Provider } from '../../../types/credentials'
import type { CredentialStore, MaskedProvider, MaskedSettings, SecretField, SettingsUpdate } from '../../../types/settings'

interface ProviderForm {
   id: Provider
   name: string
   description: string
   access?: string
   hasSecret: boolean
}

type Secrets = Partial<Record<SecretField, string>>

export type SettingsLayout = ComponentType<{ children: ReactNode, name: string }>

interface SettingsPageProps {
   layout: SettingsLayout
   providers: Provider[]
}

const storeNotes: Record<CredentialStore, string> = {
   env: 'Provided by an environment variable, which takes precedence over anything saved here.',
   keychain: 'Stored in the macOS Keychain.',
   'credential-manager': 'Stored in Windows Credential Manager.',
   keyring: 'Stored in the system keyring.',
   file: 'Stored in the settings file — the OS credential store was not reachable.',
   none: 'Nothing saved yet.'
}

const providerForms: ProviderForm[] = [
   {
      id: 'binance',
      name: 'Binance',
      description: 'Reads your staking positions and balances, and places the spot orders that rebalance your portfolios.',
      access: 'Enable Reading is enough without portfolios; portfolios also need Enable Spot & Margin Trading. Never enable Withdrawals.',
      hasSecret: true
   },
   {
      id: 'binanceTestnet',
      name: 'Binance testnet',
      description: 'Runs portfolios against the Binance spot testnet and its test funds.',
      access: 'Generate an HMAC key on testnet.binance.vision; mainnet keys do not work here.',
      hasSecret: true
   },
   {
      id: 'kraken',
      name: 'Kraken',
      description: 'Syncs your ledger and trade history, creates orders, and rebalances your portfolios. The secret is only sent for private calls.',
      access: 'Portfolios also need Create & Modify Orders and Cancel/Close Orders. Never grant Withdraw Funds.',
      hasSecret: true
   },
   {
      id: 'bybit',
      name: 'Bybit',
      description: 'Values your portfolios and places the spot market orders that rebalance them.',
      access: 'Grant Read and Spot trade only, never Withdrawal. Keys without an IP whitelist expire after 90 days.',
      hasSecret: true
   },
   {
      id: 'bybitDemo',
      name: 'Bybit demo trading',
      description: 'Same as Bybit, against the demo trading account and its test funds.',
      access: 'Create these keys from Bybit\'s demo trading mode; mainnet keys do not work here.',
      hasSecret: true
   },
   {
      id: 'anthropic',
      name: 'Anthropic',
      description: 'Writes the xStocks descriptions. Usage is billed to your own Anthropic account.',
      hasSecret: false
   }
]

function StatusBadge({ stored }: { stored: MaskedProvider | undefined }) {
   if (!stored) return null
   if (stored.configured) return <Badge variant="secondary"><CheckIcon data-icon="inline-start" />Configured</Badge>
   if (stored.keyConfigured) return <Badge variant="destructive">Secret missing</Badge>
   return <Badge variant="outline" className="text-muted-foreground">Not set</Badge>
}

interface ProviderCardProps {
   form: ProviderForm
   stored: MaskedProvider | undefined
   loading: boolean
   onSave: (form: ProviderForm, update: Secrets) => Promise<boolean>
}

function ProviderCard({ form, stored, loading, onSave }: ProviderCardProps) {

   const [draft, setDraft] = useState<Secrets>({})
   const [saving, setSaving] = useState(false)

   const fields: SecretField[] = form.hasSecret ? ['apiKey', 'apiSecret'] : ['apiKey']
   const saved = (field: SecretField) => stored?.[field] ?? ''
   const value = (field: SecretField) => draft[field] ?? saved(field)
   const dirty = fields.some(field => value(field) !== saved(field))

   const edit = (field: SecretField, next: string) => setDraft(previous => ({ ...previous, [field]: next }))

   const submit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      const update: Secrets = { apiKey: value('apiKey') }
      if (form.hasSecret) update.apiSecret = value('apiSecret')

      setSaving(true)
      if (await onSave(form, update)) setDraft({})
      setSaving(false)
   }

   return (
      <Card size="sm">
         <CardHeader>
            <CardTitle>{form.name}</CardTitle>
            <CardDescription>{form.description}</CardDescription>
            <CardAction><StatusBadge stored={stored} /></CardAction>
         </CardHeader>
         <form method="post" onSubmit={submit} className="flex flex-1 flex-col gap-3">
            <CardContent className="space-y-3">
               {form.access &&
                  <p className="flex gap-2 text-xs text-muted-foreground">
                     <ShieldCheckIcon className="mt-px size-3.5 shrink-0" />
                     {form.access}
                  </p>}
               <Input
                  name={`${form.id}-api-key`}
                  label="API key"
                  disabled={loading}
                  value={value('apiKey')}
                  onChange={event => edit('apiKey', event.target.value)} />
               {form.hasSecret &&
                  <Input
                     name={`${form.id}-api-secret`}
                     label="API secret"
                     type="password"
                     disabled={loading}
                     value={value('apiSecret')}
                     onChange={event => edit('apiSecret', event.target.value)} />}
            </CardContent>
            <CardFooter className="mt-auto gap-3">
               <p className="text-xs text-muted-foreground">{stored && storeNotes[stored.store]}</p>
               <Button type="submit" size="sm" className="ml-auto" disabled={loading || saving || !dirty}>Save</Button>
            </CardFooter>
         </form>
      </Card>
   )
}

export default function SettingsPage({ layout: Layout, providers }: SettingsPageProps) {

   // The only place that asks for the keys themselves, to prefill the form.
   const { settings, isLoading, mutate } = useSettings(SETTINGS_REVEAL_KEY)
   const { trigger: saveSettings } = useMutation<MaskedSettings, SettingsUpdate>(SETTINGS_KEY)
   const { mutate: globalMutate } = useSWRConfig()

   const save = async (form: ProviderForm, update: Secrets) => {
      try {
         await saveSettings({ [form.id]: update })
         // Both keys: this page's revealed copy, and the booleans every other page reads.
         await Promise.all([mutate(), globalMutate(SETTINGS_KEY)])
         toast.success(`${form.name} API key saved`)
         return true
      }
      catch (error) {
         toast.error(messageOf(error))
         return false
      }
   }

   return (
      <Layout name="Settings">
         <div className="grid items-start gap-6 lg:grid-cols-2">
            {providerForms.filter(({ id }) => providers.includes(id)).map(form =>
               <ProviderCard
                  key={form.id}
                  form={form}
                  stored={settings?.[form.id]}
                  loading={isLoading}
                  onSave={save} />)}
         </div>
      </Layout>
   )
}
