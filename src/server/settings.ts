import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import path from 'path'
import { resolveDataDir } from './db/paths'
import { accountIdFor } from './db/entry-key'
import { dataProfile, environmentOverridesEnabled } from './environment'
import { messageOf } from './errors'
import type { DataProfile } from './environment'
import type { Provider } from '../types/credentials'
import type { SecretField, StoredProvider, StoredSettings } from '../types/settings'

type ProviderConfig = { hasSecret: boolean, label: string }

export type SettingsState = 'missing' | 'blank' | 'data'

const SETTINGS_VERSION = 2

const SETTINGS_NAMES: Record<DataProfile, string> = {
   production: 'settings.json',
   development: 'settings-dev.json'
}

// Object.entries widens the key to string, which loses the provider union every loop
// below needs to index the settings with.
const entries = <K extends string, V>(record: Record<K, V>) =>
   Object.entries(record) as [K, V][]

export const providers: Record<Provider, ProviderConfig> = {
   kraken: { hasSecret: true, label: 'Kraken' },
   binance: { hasSecret: true, label: 'Binance' },
   binanceTestnet: { hasSecret: true, label: 'Binance testnet' },
   bybit: { hasSecret: true, label: 'Bybit' },
   bybitDemo: { hasSecret: true, label: 'Bybit demo trading' },
   anthropic: { hasSecret: false, label: 'Anthropic' }
}

const defaults = (): StoredSettings => ({
   version: SETTINGS_VERSION,
   kraken: { accountId: '' },
   binance: {},
   binanceTestnet: {},
   bybit: {},
   bybitDemo: {},
   anthropic: {}
})

function settingsPath(profile: DataProfile = dataProfile()): string {
   return path.join(resolveDataDir(), SETTINGS_NAMES[profile])
}

function readFile(profile: DataProfile = dataProfile()): StoredSettings {
   try {
      const file = settingsPath(profile)
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
   const prefix = provider.replace(/[A-Z]/g, letter => `_${letter}`).toUpperCase()
   const name = `${prefix}_${field === 'apiSecret' ? 'API_SECRET' : 'API_KEY'}`
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

export function settingsFilePath(profile: DataProfile = dataProfile()): string {
   return settingsPath(profile)
}

export function settingsState(profile: DataProfile): SettingsState {
   if (!existsSync(settingsPath(profile))) return 'missing'

   const stored = readFile(profile)
   const holdsKey = entries(providers).some(([id]) => stored[id].apiKey || stored[id].apiSecret)

   return stored.kraken.accountId || holdsKey ? 'data' : 'blank'
}

export function copySettingsFrom(profile: DataProfile): void {
   writeFile(readFile(profile))
}
