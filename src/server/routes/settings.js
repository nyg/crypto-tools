import { Hono } from 'hono'
import { providers, readSettings, writeSettings } from '../settings.js'

const app = new Hono()

const MASK = '*****'

// Only the Settings form has any use for the key itself; every other page reads the
// booleans below. Withholding it by default keeps the plaintext out of the SWR cache
// of all nine of them.
function maskSettings(settings, { reveal = false } = {}) {
   const masked = { version: settings.version, secretStore: settings.secretStore }

   for (const [id, { hasSecret }] of Object.entries(providers)) {
      const { apiKey, apiSecret, source, unreadable } = settings[id]

      masked[id] = {
         source,
         hasSecret,
         unreadable: unreadable ?? null,
         apiKey: reveal ? apiKey : (apiKey ? MASK : ''),
         apiSecret: hasSecret && apiSecret ? MASK : '',
         configured: Boolean(apiKey) && (!hasSecret || Boolean(apiSecret)),
         keyConfigured: Boolean(apiKey)
      }
   }

   masked.kraken.accountId = settings.kraken.accountId

   return masked
}

app.get('/', (c) =>
   c.json(maskSettings(readSettings(), { reveal: c.req.query('reveal') === 'true' })))

app.post('/', async (c) => {
   try {
      const body = await c.req.json()
      const updates = {}

      for (const id of Object.keys(providers)) {
         const update = body?.[id]
         if (!update) continue

         // A field still holding the mask was never edited, so saving must leave the
         // stored value alone rather than overwrite it with the placeholder.
         updates[id] = { ...update }
         if (updates[id].apiKey === MASK) delete updates[id].apiKey
         if (updates[id].apiSecret === MASK) delete updates[id].apiSecret
      }

      return c.json(maskSettings(writeSettings(updates)))
   }
   catch (error) {
      console.error('Could not save the settings:', error)
      return c.json({ error: 'Could not save the settings.' }, 500)
   }
})

export default app
