import { Hono } from 'hono'
import { providers, readSettings, writeSettings } from '../settings.js'

const app = new Hono()

const MASK = '*****'

function maskSettings(settings) {
   const masked = { version: settings.version }

   for (const [id, { hasSecret }] of Object.entries(providers)) {
      const { apiKey, apiSecret, source } = settings[id]

      masked[id] = {
         apiKey,
         source,
         hasSecret,
         apiSecret: hasSecret && apiSecret ? MASK : '',
         configured: Boolean(apiKey) && (!hasSecret || Boolean(apiSecret)),
         keyConfigured: Boolean(apiKey)
      }
   }

   masked.kraken.accountId = settings.kraken.accountId
   masked.kraken.keyPrefix = settings.kraken.apiKey.slice(0, 8)

   return masked
}

app.get('/', (c) => c.json(maskSettings(readSettings())))

app.post('/', async (c) => {
   try {
      const body = await c.req.json()
      const updates = {}

      for (const id of Object.keys(providers)) {
         const update = body?.[id]
         if (!update) continue

         updates[id] = { ...update }
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
