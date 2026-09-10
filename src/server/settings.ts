import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import path from 'path'
import { resolveDataDir } from './db/paths'
import { accountIdFor } from './db/entry-key'
import { environmentOverridesEnabled } from './environment'
import { messageOf } from './errors'
import type { Provider } from '../types/credentials'
import type { SecretField, StoredProvider, StoredSettings } from '../types/settings'

type ProviderConfig = { hasSecret: boolean }

const SETTINGS_VERSION = 2

// Object.entries widens the key to string, which loses the provider union every loop
// below needs to index the settings with.
const entries = <K extends string, V>(record: Record<K, V>) =>
   Object.entries(record) as [K, V][]

export const providers: Record<Provider, ProviderConfig> = {
   kraken: { hasSecret: true },
   binance: { hasSecret: true },
   anthropic: { hasSecret: false }
}

const defaults = (): StoredSettings => ({
   version: SETTINGS_VERSION,
   kraken: { accountId: '' },
   binance: {},
   anthropic: {}
})

function settingsPath(): string {
   const name = process.env.NODE_ENV === 'production' ? 'settings.json' : 'settings-dev.json'
   return path.join(resolveDataDir(), name)
}

function readFile(): StoredSettings {
   try {
      const file = settingsPath()
      if (!existsSync(file)) return defaults()
      const stored = JSON.parse(readFileSync(file, 'utf-8')) as Partial<StoredSettings>
      const merged = defaults()

      for (const [id] of entries(providers)) {
         const saved = stored[id]
         if (saved?.apiKey !== undefined) merged[id].apiKey = saved.apiKey
         if (saved?.apiSecret !== undefined) merged[id].apiSecret = saved.apiSecret
      }

      merged.kraken.accountId = stored.kraken?.accountId ?? ''
      return merged
   }
   catch (error) {
      console.warn('Could not read the settings file, falling back to defaults:', messageOf(error))
      return defaults()
   }
}

function writeFile(settings: StoredSettings): void {
   // Written to a sibling and renamed over the target: a crash or a full disk part way
   // through would otherwise truncate the file and take every provider's keys with it.
   // The rename also carries the temp file's 0600 across, which a plain write would not
   // — mode applies only when open(2) creates the file, so a target whose permissions
   // had been widened elsewhere would keep them for every save after.
   const file = settingsPath()
   const temporary = `${file}.tmp`

   mkdirSync(path.dirname(file), { recursive: true })
   writeFileSync(temporary, JSON.stringify(settings, null, 3), { encoding: 'utf-8', mode: 0o600 })
   chmodSync(temporary, 0o600)
   renameSync(temporary, file)
}

export function environmentValue(provider: Provider, field: SecretField): string {
   if (!environmentOverridesEnabled()) return ''
   const name = `${provider.toUpperCase()}_${field === 'apiSecret' ? 'API_SECRET' : 'API_KEY'}`
   return process.env[name] || process.env[`VITE_${name}`] || ''
}

export function readStoredSecret(provider: Provider, field: SecretField): string {
   const stored: StoredProvider = readFile()[provider]
   return stored[field] || ''
}

export function writeStoredSecret(provider: Provider, field: SecretField, value: string | null): void {
   const settings = readFile()
   const stored: StoredProvider = settings[provider]

   if (value === null) {
      if (stored[field] === undefined) return
      delete stored[field]
   }
   else {
      stored[field] = value
   }

   writeFile(settings)
}

export function krakenAccountId(): string {
   const fromEnvironment = environmentValue('kraken', 'apiKey')
   if (fromEnvironment) return accountIdFor(fromEnvironment)
   return readFile().kraken.accountId
}

export function rememberKrakenAccount(apiKey: string): void {
   const settings = readFile()

   const accountId = apiKey ? (settings.kraken.accountId || accountIdFor(apiKey)) : ''
   if (settings.kraken.accountId === accountId) return

   settings.kraken.accountId = accountId
   writeFile(settings)
}

export function settingsVersion(): number {
   return readFile().version
}

export function settingsFilePath(): string {
   return settingsPath()
}
