import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import path from 'path'
import { resolveDataDir } from './db/paths.js'
import { accountIdFor } from './db/entry-key.js'
import { readSecret, removeSecret, secretStore, writeSecret } from './secret-store/index.js'

const SETTINGS_VERSION = 2

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

const fieldsOf = ({ hasSecret }) => hasSecret ? ['apiKey', 'apiSecret'] : ['apiKey']

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

// Written to a sibling and renamed over the target: a crash or a full disk part way
// through would otherwise truncate the file and take every provider's keys with it.
// The rename also carries the temp file's 0600 across, which a plain write would not
// — mode applies only when open(2) creates the file, so a target whose permissions
// had been widened elsewhere would keep them for every save after.
function writeStored(settings) {
   const file = settingsPath()
   const temporary = `${file}.tmp`

   mkdirSync(path.dirname(file), { recursive: true })
   writeFileSync(temporary, JSON.stringify(settings, null, 3), { encoding: 'utf-8', mode: 0o600 })
   chmodSync(temporary, 0o600)
   renameSync(temporary, file)
}

function envValue(provider, field) {
   const name = `${provider.toUpperCase()}_${field === 'apiSecret' ? 'API_SECRET' : 'API_KEY'}`
   return process.env[name] || process.env[`VITE_${name}`] || ''
}

const storedInKeychain = saved => saved.storage === 'keychain'

const sourceOf = saved => storedInKeychain(saved) ? (secretStore()?.id ?? 'file') : 'file'

function savedValue(provider, field, saved) {
   if (!storedInKeychain(saved)) return saved[field] || ''
   return readSecret(`${provider}.${field}`) ?? saved[field] ?? ''
}

function persistProvider(provider, values) {
   const fields = Object.keys(values)

   if (secretStore()) {
      const stashed = fields
         .map(field => values[field] === ''
            ? removeSecret(`${provider}.${field}`)
            : writeSecret(`${provider}.${field}`, values[field]))
         .every(Boolean)

      if (stashed) return { storage: 'keychain' }

      console.warn(`Could not hand ${provider}'s credentials to the credential store, keeping them in the settings file.`)
      fields.forEach(field => removeSecret(`${provider}.${field}`))
   }

   return fields.reduce((entry, field) => ({ ...entry, [field]: values[field] }), { storage: 'file' })
}

export function readSettings() {
   const stored = readStored()
   const settings = defaults()
   const environmentWins = process.env.NODE_ENV !== 'production'

   for (const [id, provider] of Object.entries(providers)) {
      const { hasSecret } = provider
      const saved = stored[id] ?? {}

      const environmentKey = environmentWins ? envValue(id, 'apiKey') : ''
      const environmentSecret = environmentWins && hasSecret ? envValue(id, 'apiSecret') : ''

      // Half a credential is not a credential. Exporting only the key would otherwise
      // blank a secret sitting in the file and 401 every private call, while the
      // Settings page went on showing a populated key.
      const fromEnvironment = Boolean(environmentKey) && (!hasSecret || Boolean(environmentSecret))

      settings[id].source = fromEnvironment ? 'env' : sourceOf(saved)

      try {
         settings[id].apiKey = fromEnvironment ? environmentKey : savedValue(id, 'apiKey', saved)

         if (hasSecret) {
            settings[id].apiSecret = fromEnvironment ? environmentSecret : savedValue(id, 'apiSecret', saved)
         }
      }
      catch (error) {
         console.warn(`Could not read ${id}'s credentials from the credential store:`, error.message)
         settings[id].unreadable = true
      }
   }

   // The stored id belongs to the stored key. A key from the environment is a
   // different account, so it gets its own partition rather than syncing into
   // whichever one the file happens to name.
   settings.kraken.accountId = settings.kraken.unreadable
      ? (stored.kraken?.accountId || '')
      : settings.kraken.apiKey === ''
         ? ''
         : settings.kraken.source === 'env'
            ? accountIdFor(settings.kraken.apiKey)
            : (stored.kraken?.accountId || accountIdFor(settings.kraken.apiKey))

   return settings
}

export function writeSettings(updates) {
   const stored = readStored()
   const merged = { ...stored, version: SETTINGS_VERSION }
   const resolved = {}

   for (const [id, provider] of Object.entries(providers)) {
      const update = updates?.[id]
      if (!update) continue

      const saved = stored[id] ?? {}

      const values = Object.fromEntries(fieldsOf(provider)
         .map(field => [field, typeof update[field] === 'string'
            ? update[field].trim()
            : savedValue(id, field, saved)]))

      resolved[id] = values
      merged[id] = persistProvider(id, values)
   }

   if (resolved.kraken) {
      const accountId = stored.kraken?.accountId || ''
      merged.kraken.accountId = resolved.kraken.apiKey
         ? (accountId || accountIdFor(resolved.kraken.apiKey))
         : accountId
   }

   writeStored(merged)

   return readSettings()
}

export function migrateSettings() {
   const stored = readStored()

   if (Object.keys(stored).length === 0 || !secretStore()) return

   const inFile = Object.entries(providers)
      .filter(([id, provider]) => fieldsOf(provider).some(field => stored[id]?.[field]))

   if (stored.version === SETTINGS_VERSION && inFile.length === 0) return

   const migrated = { ...stored, version: SETTINGS_VERSION }
   const moved = []

   for (const [id, provider] of inFile) {
      const saved = stored[id]
      const values = Object.fromEntries(fieldsOf(provider).map(field => [field, saved[field] || '']))
      const entry = persistProvider(id, values)

      migrated[id] = saved.accountId ? { ...entry, accountId: saved.accountId } : entry

      if (entry.storage === 'keychain') moved.push(id)
   }

   writeStored(migrated)

   if (moved.length > 0) {
      console.log(`✓ Moved ${moved.join(', ')} credentials out of the settings file and into the ${secretStore().id}.`)
   }
}

export function credentialsFor(provider) {
   const { apiKey, apiSecret, unreadable } = readSettings()[provider]

   if (unreadable) {
      throw new Error(`Could not read ${provider}'s credentials from the ${secretStore()?.id ?? 'credential store'}.`)
   }

   return { apiKey, apiSecret: apiSecret ?? '' }
}

export function krakenAccountId() {
   return readSettings().kraken.accountId
}
