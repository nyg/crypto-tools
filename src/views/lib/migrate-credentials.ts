import { messageOf } from './errors'
import type { MaskedSettings, SettingsUpdate } from '../../types/settings'
import type { Provider } from '../../types/credentials'

const legacyEntries: Record<Provider, Record<string, string>> = {
   binance: { apiKey: 'binance.api.key', apiSecret: 'binance.api.secret' },
   kraken: { apiKey: 'kraken.api.key', apiSecret: 'kraken.api.secret' },
   anthropic: { apiKey: 'anthropic.api.key' }
}

const readLegacy = (): SettingsUpdate => Object.entries(legacyEntries)
   .reduce<SettingsUpdate>((found, [provider, fields]) => {
      const values = Object.entries(fields).reduce<Record<string, string>>((entry, [field, key]) => {
         const value = localStorage.getItem(key)
         if (value) entry[field] = value
         return entry
      }, {})

      if (values.apiKey) found[provider as Provider] = values
      return found
   }, {})

const forgetLegacy = () => Object.values(legacyEntries)
   .flatMap(fields => Object.values(fields))
   .forEach(key => localStorage.removeItem(key))

// Keys used to live in this browser's local storage. They now belong to the server, so
// the ones left behind are handed over once and then removed — an upgrade should not
// cost the user their configuration, nor leave their secrets in the WebView's store.
// A provider the server already knows about is left alone: what is on disk was entered
// more recently than whatever this browser is still holding.
export default async function migrateLegacyCredentials(apiBase = ''): Promise<void> {

   if (typeof window === 'undefined') return

   const legacy = readLegacy()
   if (Object.keys(legacy).length === 0) return

   // Bounded because main.jsx awaits this before mounting React: a server that accepts
   // the connection but never answers would otherwise leave a blank window with nothing
   // on screen to explain it. The legacy entries are only removed on success, so a
   // timed-out migration simply runs again next launch.
   const signal = AbortSignal.timeout(5000)

   try {
      const response = await fetch(`${apiBase}/api/settings`, { signal })
      if (!response.ok) return

      const settings = await response.json() as MaskedSettings
      const updates = Object.fromEntries(Object.entries(legacy)
         .filter(([provider]) => !settings[provider as Provider]?.keyConfigured))

      if (Object.keys(updates).length > 0) {
         const saved = await fetch(`${apiBase}/api/settings`, {
            method: 'POST',
            body: JSON.stringify(updates),
            headers: { 'Content-Type': 'application/json' },
            signal
         })
         if (!saved.ok) return

         console.log(`Moved ${Object.keys(updates).join(', ')} credentials out of local storage.`)
      }

      forgetLegacy()
   }
   catch (error) {
      console.warn('Could not move the stored credentials to the server:', messageOf(error))
   }
}
