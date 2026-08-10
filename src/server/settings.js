import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { resolveDataDir } from './db/paths.js'
import { accountIdFor } from './db/entry-key.js'

const SETTINGS_VERSION = 1

export const providers = {
   kraken: { hasSecret: true },
   binance: { hasSecret: true },
   anthropic: { hasSecret: false }
}

const defaults = () => ({
   version: SETTINGS_VERSION,
   kraken: { apiKey: '', apiSecret: '', accountId: '' },
   binance: { apiKey: '', apiSecret: '' },
   anthropic: { apiKey: '' }
})

function settingsPath() {
   const name = process.env.NODE_ENV === 'production' ? 'settings.json' : 'settings-dev.json'
   return path.join(resolveDataDir(), name)
}

function readStored() {
   try {
      const file = settingsPath()
      if (!existsSync(file)) return {}
      return JSON.parse(readFileSync(file, 'utf-8'))
   }
   catch (error) {
      console.warn('Could not read the settings file, falling back to defaults:', error.message)
      return {}
   }
}

function envValue(provider, field) {
   const name = `${provider.toUpperCase()}_${field === 'apiSecret' ? 'API_SECRET' : 'API_KEY'}`
   return process.env[name] || process.env[`VITE_${name}`] || ''
}

export function readSettings() {
   const stored = readStored()
   const settings = defaults()
   const environmentWins = process.env.NODE_ENV !== 'production'

   for (const [id, { hasSecret }] of Object.entries(providers)) {
      const saved = stored[id] ?? {}
      const fromEnvironment = environmentWins ? envValue(id, 'apiKey') : ''

      settings[id].apiKey = fromEnvironment || saved.apiKey || ''
      settings[id].source = fromEnvironment ? 'env' : 'file'

      if (hasSecret) {
         settings[id].apiSecret = fromEnvironment
            ? envValue(id, 'apiSecret')
            : (saved.apiSecret || '')
      }
   }

   settings.kraken.accountId = stored.kraken?.accountId
      || (settings.kraken.apiKey ? accountIdFor(settings.kraken.apiKey) : '')

   return settings
}

export function writeSettings(updates) {
   const merged = { ...defaults(), ...readStored(), version: SETTINGS_VERSION }

   for (const [id, { hasSecret }] of Object.entries(providers)) {
      const update = updates?.[id]
      if (!update) continue

      merged[id] = { ...merged[id] }
      if (typeof update.apiKey === 'string') merged[id].apiKey = update.apiKey.trim()
      if (hasSecret && typeof update.apiSecret === 'string') merged[id].apiSecret = update.apiSecret.trim()
   }

   if (merged.kraken.apiKey && !merged.kraken.accountId) {
      merged.kraken.accountId = accountIdFor(merged.kraken.apiKey)
   }

   const file = settingsPath()
   mkdirSync(path.dirname(file), { recursive: true })
   writeFileSync(file, JSON.stringify(merged, null, 3), { encoding: 'utf-8', mode: 0o600 })

   return readSettings()
}

export function credentialsFor(provider) {
   const { apiKey, apiSecret } = readSettings()[provider]
   return { apiKey, apiSecret: apiSecret ?? '' }
}

export function hasCredentials(provider, { secret = false } = {}) {
   const { apiKey, apiSecret } = credentialsFor(provider)
   return Boolean(apiKey) && (!secret || Boolean(apiSecret))
}

export function krakenAccountId() {
   return readSettings().kraken.accountId
}
