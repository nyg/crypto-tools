const legacyEntries = {
   binance: { apiKey: 'binance.api.key', apiSecret: 'binance.api.secret' },
   kraken: { apiKey: 'kraken.api.key', apiSecret: 'kraken.api.secret' },
   anthropic: { apiKey: 'anthropic.api.key' }
}

const readLegacy = () => Object.entries(legacyEntries).reduce((found, [provider, fields]) => {
   const values = Object.entries(fields).reduce((entry, [field, key]) => {
      const value = localStorage.getItem(key)
      if (value) entry[field] = value
      return entry
   }, {})

   if (values.apiKey) found[provider] = values
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
export default async function migrateLegacyCredentials(apiBase = '') {

   if (typeof window === 'undefined') return

   const legacy = readLegacy()
   if (Object.keys(legacy).length === 0) return

   try {
      const response = await fetch(`${apiBase}/api/settings`)
      if (!response.ok) return

      const settings = await response.json()
      const updates = Object.fromEntries(Object.entries(legacy)
         .filter(([provider]) => !settings[provider]?.keyConfigured))

      if (Object.keys(updates).length > 0) {
         const saved = await fetch(`${apiBase}/api/settings`, {
            method: 'POST',
            body: JSON.stringify(updates),
            headers: { 'Content-Type': 'application/json' }
         })
         if (!saved.ok) return

         console.log(`Moved ${Object.keys(updates).join(', ')} credentials out of local storage.`)
      }

      forgetLegacy()
   }
   catch (error) {
      console.warn('Could not move the stored credentials to the server:', error.message)
   }
}
