import { Hono } from 'hono'
import secrets from '../secrets'
import { krakenAccountId, providers, settingsVersion } from '../settings'
import type { Provider } from '../../types/credentials'
import type {
   MaskedProvider, MaskedSettings, ProviderSecrets, SettingsUpdate
} from '../../types/settings'

const app = new Hono()

const MASK = '*****'

// Only the Settings form has any use for the key itself; every other page reads the
// booleans below. Withholding it by default keeps the plaintext out of the SWR cache
// of all nine of them.
function maskSettings(
   stored: Record<Provider, ProviderSecrets>, { reveal = false } = {}
): MaskedSettings {

   const mask = (id: Provider): MaskedProvider => {
      const { hasSecret } = providers[id]
      const { apiKey, apiSecret, store } = stored[id]

      return {
         store,
         hasSecret,
         apiKey: reveal ? apiKey : (apiKey ? MASK : ''),
         apiSecret: hasSecret && apiSecret ? MASK : '',
         configured: Boolean(apiKey) && (!hasSecret || Boolean(apiSecret)),
         keyConfigured: Boolean(apiKey)
      }
   }

   return {
      version: settingsVersion(),
      kraken: { ...mask('kraken'), accountId: krakenAccountId() },
      binance: mask('binance'),
      anthropic: mask('anthropic')
   }
}

app.get('/', async (c) =>
   c.json(maskSettings(await secrets.readAll(), { reveal: c.req.query('reveal') === 'true' })))

app.post('/', async (c) => {
   try {
      const body = await c.req.json<SettingsUpdate>()
      const updates: SettingsUpdate = {}

      for (const id of Object.keys(providers) as Provider[]) {
         const update = body?.[id]
         if (!update) continue

         // A field still holding the mask was never edited, so saving must leave the
         // stored value alone rather than overwrite it with the placeholder.
         const next = { ...update }
         if (next.apiKey === MASK) delete next.apiKey
         if (next.apiSecret === MASK) delete next.apiSecret
         updates[id] = next
      }

      await secrets.save(updates)
      return c.json(maskSettings(await secrets.readAll()))
   }
   catch (error) {
      console.error('Could not save the settings:', error)
      return c.json({ error: 'Could not save the settings.' }, 500)
   }
})

export default app
