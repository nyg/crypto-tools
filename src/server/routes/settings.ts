import { Hono } from 'hono'
import { providers, readSettings, writeSettings } from '../settings'
import type { Provider } from '../../types/credentials'
import type { MaskedProvider, MaskedSettings, Settings, SettingsUpdate } from '../../types/settings'

const app = new Hono()

const MASK = '*****'

// Only the Settings form has any use for the key itself; every other page reads the
// booleans below. Withholding it by default keeps the plaintext out of the SWR cache
// of all nine of them.
function maskSettings(settings: Settings, { reveal = false } = {}): MaskedSettings {

   const mask = (id: Provider): MaskedProvider => {
      const { hasSecret } = providers[id]
      const { apiKey, apiSecret, source } = settings[id]

      return {
         source: source ?? 'file',
         hasSecret,
         apiKey: reveal ? apiKey : (apiKey ? MASK : ''),
         apiSecret: hasSecret && apiSecret ? MASK : '',
         configured: Boolean(apiKey) && (!hasSecret || Boolean(apiSecret)),
         keyConfigured: Boolean(apiKey)
      }
   }

   return {
      version: settings.version,
      kraken: { ...mask('kraken'), accountId: settings.kraken.accountId },
      binance: mask('binance'),
      anthropic: mask('anthropic')
   }
}

app.get('/', (c) =>
   c.json(maskSettings(readSettings(), { reveal: c.req.query('reveal') === 'true' })))

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

      return c.json(maskSettings(writeSettings(updates)))
   }
   catch (error) {
      console.error('Could not save the settings:', error)
      return c.json({ error: 'Could not save the settings.' }, 500)
   }
})

export default app
