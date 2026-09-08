import {
   environmentValue, providers, readStoredSecret, rememberKrakenAccount, writeStoredSecret
} from './settings'
import { messageOf } from './errors'
import type { Credentials, Provider } from '../types/credentials'
import type {
   CredentialStore, ProviderSecrets, SecretField, SettingsUpdate
} from '../types/settings'

// Keeping the dev and packaged builds on separate services means `bun run dev` cannot
// overwrite the keys of the installed app, the way settings-dev.json already keeps their
// files apart. Suffixing the service rather than the entry name also groups the entries
// under one name in Keychain Access, and gives Windows two separable target prefixes.
const SERVICE = process.env.CRYPTO_TOOLS_KEYCHAIN_SERVICE
   ?? (process.env.NODE_ENV === 'production'
      ? 'io.github.nyg.crypto-tools'
      : 'io.github.nyg.crypto-tools.dev')

const fields: Record<SecretField, string> = { apiKey: 'api-key', apiSecret: 'api-secret' }

const entryName = (provider: Provider, field: SecretField) => `${provider}-${fields[field]}`

const providerEntries = () =>
   Object.entries(providers) as [Provider, { hasSecret: boolean }][]

const secretFields = (provider: Provider): SecretField[] =>
   providers[provider].hasSecret ? ['apiKey', 'apiSecret'] : ['apiKey']

function nativeStore(): CredentialStore {
   if (process.platform === 'darwin') return 'keychain'
   if (process.platform === 'win32') return 'credential-manager'
   return 'keyring'
}

class SecretStore {

   #warned = false

   // A machine with no secret service — a headless Linux box, or a user who refused the
   // Keychain prompt — must keep working, so every call through here can fail, and the
   // file behind it takes over. Saying so once is enough; once per read would drown the
   // log of a page that asks for three providers.
   #reportUnavailable(action: string, error: unknown): void {
      if (this.#warned) return
      this.#warned = true
      console.warn(
         `Could not ${action} a credential in the OS credential store, using the settings file instead:`,
         messageOf(error))
   }

   async #read(provider: Provider, field: SecretField): Promise<string> {
      try {
         const stored = await Bun.secrets.get({ service: SERVICE, name: entryName(provider, field) })
         if (stored) return stored
      }
      catch (error) {
         this.#reportUnavailable('read', error)
      }

      return readStoredSecret(provider, field)
   }

   async #write(provider: Provider, field: SecretField, value: string): Promise<void> {
      const name = entryName(provider, field)

      try {
         if (value) await Bun.secrets.set({ service: SERVICE, name, value })
         else await Bun.secrets.delete({ service: SERVICE, name })
      }
      catch (error) {
         // Losing the value would be worse than leaving it in a 0600 file, so a refusal
         // falls back rather than throwing.
         this.#reportUnavailable('store', error)
         writeStoredSecret(provider, field, value || null)
         return
      }

      // The store took it, so any earlier plaintext copy is now stale.
      writeStoredSecret(provider, field, null)
   }

   async #storeOf(provider: Provider): Promise<CredentialStore> {
      const configured = secretFields(provider)
         .map(field => ({ field, value: environmentValue(provider, field) }))

      if (configured.some(({ value }) => value)) return 'env'

      let store: CredentialStore = 'none'

      for (const { field } of configured) {
         const inStore = await Bun.secrets
            .get({ service: SERVICE, name: entryName(provider, field) })
            .catch(() => null)

         if (inStore) store = store === 'file' ? 'file' : nativeStore()
         else if (readStoredSecret(provider, field)) store = 'file'
      }

      return store
   }

   async secretsFor(provider: Provider): Promise<ProviderSecrets> {
      const fromEnvironment = secretFields(provider)
         .map(field => environmentValue(provider, field))

      // Half a credential is not a credential. Exporting only the key would otherwise
      // blank a secret sitting in the store and 401 every private call, while the
      // Settings page went on showing a populated key.
      if (fromEnvironment.every(Boolean) && fromEnvironment.length > 0) {
         const [apiKey = '', apiSecret = ''] = fromEnvironment
         return { apiKey, apiSecret, store: 'env' }
      }

      const [apiKey, apiSecret, store] = await Promise.all([
         this.#read(provider, 'apiKey'),
         providers[provider].hasSecret ? this.#read(provider, 'apiSecret') : Promise.resolve(''),
         this.#storeOf(provider)
      ])

      return { apiKey, apiSecret, store }
   }

   async credentialsFor(provider: Provider): Promise<Credentials> {
      const { apiKey, apiSecret } = await this.secretsFor(provider)
      return { apiKey, apiSecret }
   }

   async readAll(): Promise<Record<Provider, ProviderSecrets>> {
      const read = await Promise.all(
         providerEntries().map(async ([id]) => [id, await this.secretsFor(id)] as const))

      return Object.fromEntries(read) as Record<Provider, ProviderSecrets>
   }

   async save(updates: SettingsUpdate): Promise<void> {
      for (const [id] of providerEntries()) {
         const update = updates[id]
         if (!update) continue

         for (const field of secretFields(id)) {
            const value = update[field]
            if (typeof value !== 'string') continue

            const trimmed = value.trim()
            await this.#write(id, field, trimmed)

            // The account id has to follow the key it belongs to, and it is written
            // before anything reads it back through the synchronous path.
            if (id === 'kraken' && field === 'apiKey') rememberKrakenAccount(trimmed)
         }
      }
   }

   // Keys written by an earlier version sit in plaintext in settings.json. Move them
   // across on startup, and leave them exactly where they are if the store refuses.
   async migrate(): Promise<void> {
      for (const [id] of providerEntries()) {
         for (const field of secretFields(id)) {
            const stored = readStoredSecret(id, field)
            if (!stored) continue

            if (id === 'kraken' && field === 'apiKey') rememberKrakenAccount(stored)

            try {
               await Bun.secrets.set({ service: SERVICE, name: entryName(id, field), value: stored })
               writeStoredSecret(id, field, null)
            }
            catch (error) {
               this.#reportUnavailable('store', error)
               return
            }
         }
      }
   }
}

const secrets = new SecretStore()

export default secrets
export const credentialsFor = (provider: Provider) => secrets.credentialsFor(provider)
export const migrateSecretsToCredentialStore = () => secrets.migrate()
