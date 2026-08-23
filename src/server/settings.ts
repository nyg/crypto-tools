import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import path from 'path'
import { resolveDataDir } from './db/paths'
import { accountIdFor } from './db/entry-key'
import { messageOf } from './errors'
import type { Credentials, Provider } from '../types/credentials'
import type { ProviderSettings, Settings, SettingsUpdate } from '../types/settings'

type ProviderConfig = { hasSecret: boolean }

const SETTINGS_VERSION = 1

// Object.entries widens the key to string, which loses the provider union every loop
// below needs to index the settings with.
const entries = <K extends string, V>(record: Record<K, V>) =>
   Object.entries(record) as [K, V][]

export const providers: Record<Provider, ProviderConfig> = {
   kraken: { hasSecret: true },
   binance: { hasSecret: true },
   anthropic: { hasSecret: false }
}

const defaults = (): Settings => ({
   version: SETTINGS_VERSION,
   kraken: { apiKey: '', apiSecret: '', accountId: '' },
   binance: { apiKey: '', apiSecret: '' },
   anthropic: { apiKey: '' }
})

function settingsPath(): string {
   const name = process.env.NODE_ENV === 'production' ? 'settings.json' : 'settings-dev.json'
   return path.join(resolveDataDir(), name)
}

function readStored(): Partial<Settings> {
   try {
      const file = settingsPath()
      if (!existsSync(file)) return {}
      return JSON.parse(readFileSync(file, 'utf-8')) as Partial<Settings>
   }
   catch (error) {
      console.warn('Could not read the settings file, falling back to defaults:', messageOf(error))
      return {}
   }
}

function envValue(provider: Provider, field: 'apiKey' | 'apiSecret'): string {
   const name = `${provider.toUpperCase()}_${field === 'apiSecret' ? 'API_SECRET' : 'API_KEY'}`
   return process.env[name] || process.env[`VITE_${name}`] || ''
}

export function readSettings(): Settings {
   const stored = readStored()
   const settings = defaults()
   const environmentWins = process.env.NODE_ENV !== 'production'

   for (const [id, { hasSecret }] of entries(providers)) {
      const saved: Partial<ProviderSettings> = stored[id] ?? {}

      const environmentKey = environmentWins ? envValue(id, 'apiKey') : ''
      const environmentSecret = environmentWins && hasSecret ? envValue(id, 'apiSecret') : ''

      // Half a credential is not a credential. Exporting only the key would otherwise
      // blank a secret sitting in the file and 401 every private call, while the
      // Settings page went on showing a populated key.
      const fromEnvironment = Boolean(environmentKey) && (!hasSecret || Boolean(environmentSecret))

      settings[id].apiKey = fromEnvironment ? environmentKey : (saved.apiKey || '')
      settings[id].source = fromEnvironment ? 'env' : 'file'

      if (hasSecret) {
         settings[id].apiSecret = fromEnvironment ? environmentSecret : (saved.apiSecret || '')
      }
   }

   // The stored id belongs to the stored key. A key from the environment is a
   // different account, so it gets its own partition rather than syncing into
   // whichever one the file happens to name.
   settings.kraken.accountId = settings.kraken.apiKey === ''
      ? ''
      : settings.kraken.source === 'env'
         ? accountIdFor(settings.kraken.apiKey)
         : (stored.kraken?.accountId || accountIdFor(settings.kraken.apiKey))

   return settings
}

export function writeSettings(updates: SettingsUpdate | undefined): Settings {
   const merged = { ...defaults(), ...readStored(), version: SETTINGS_VERSION }

   for (const [id, { hasSecret }] of entries(providers)) {
      const update = updates?.[id]
      if (!update) continue

      if (typeof update.apiKey === 'string') merged[id].apiKey = update.apiKey.trim()
      if (hasSecret && typeof update.apiSecret === 'string') merged[id].apiSecret = update.apiSecret.trim()
   }

   if (merged.kraken.apiKey && !merged.kraken.accountId) {
      merged.kraken.accountId = accountIdFor(merged.kraken.apiKey)
   }

   // Written to a sibling and renamed over the target: a crash or a full disk part way
   // through would otherwise truncate the file and take every provider's keys with it.
   // The rename also carries the temp file's 0600 across, which a plain write would not
   // — mode applies only when open(2) creates the file, so a target whose permissions
   // had been widened elsewhere would keep them for every save after.
   const file = settingsPath()
   const temporary = `${file}.tmp`

   mkdirSync(path.dirname(file), { recursive: true })
   writeFileSync(temporary, JSON.stringify(merged, null, 3), { encoding: 'utf-8', mode: 0o600 })
   chmodSync(temporary, 0o600)
   renameSync(temporary, file)

   return readSettings()
}

export function credentialsFor(provider: Provider): Credentials {
   const { apiKey, apiSecret } = readSettings()[provider]
   return { apiKey, apiSecret: apiSecret ?? '' }
}

export function krakenAccountId(): string {
   return readSettings().kraken.accountId
}
