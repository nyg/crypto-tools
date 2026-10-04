import {
   environmentValue, providers, readStoredSecret, rememberKrakenAccount, writeStoredSecret
} from './settings'
import { dataProfile } from './environment'
import { messageOf } from './errors'
import type { DataProfile } from './environment'
import type { Credentials, Provider } from '../types/credentials'
import type {
   CredentialStore, ProviderSecrets, SecretField, SettingsUpdate
} from '../types/settings'

const PRODUCTION_SERVICE = 'io.github.nyg.crypto-tools'

export interface StoreEntries {
   values: Map<string, string>
   complete: boolean
}

function serviceOf(profile: DataProfile = dataProfile()): string {
   const production = process.env.CRYPTO_TOOLS_KEYCHAIN_SERVICE ?? PRODUCTION_SERVICE
   return profile === 'production' ? production : `${production}.dev`
}

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

   #reportUnavailable(action: string, error: unknown): void {
      if (this.#warned) return
      this.#warned = true
      console.warn(
         `Could not ${action} a credential in the OS credential store, using the settings file instead:`,
         messageOf(error))
   }

   async #read(provider: Provider, field: SecretField): Promise<string> {
      try {
         const stored = await Bun.secrets.get({ service: serviceOf(), name: entryName(provider, field) })
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
         if (value) await Bun.secrets.set({ service: serviceOf(), name, value })
         else await Bun.secrets.delete({ service: serviceOf(), name })
      }
      catch (error) {
         this.#reportUnavailable('store', error)
         writeStoredSecret(provider, field, value || null)
         return
      }

      writeStoredSecret(provider, field, null)
   }

   async #storeOf(provider: Provider): Promise<CredentialStore> {
      const configured = secretFields(provider)
         .map(field => ({ field, value: environmentValue(provider, field) }))

      if (configured.some(({ value }) => value)) return 'env'

      let store: CredentialStore = 'none'

      for (const { field } of configured) {
         const inStore = await Bun.secrets
            .get({ service: serviceOf(), name: entryName(provider, field) })
            .catch(() => null)

         if (inStore) store = store === 'file' ? 'file' : nativeStore()
         else if (readStoredSecret(provider, field)) store = 'file'
      }

      return store
   }

   async secretsFor(provider: Provider): Promise<ProviderSecrets> {
      const fromEnvironment = secretFields(provider)
         .map(field => environmentValue(provider, field))

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

            if (id === 'kraken' && field === 'apiKey') rememberKrakenAccount(trimmed)
         }
      }
   }

   async storeEntries(profile: DataProfile): Promise<StoreEntries> {
      const service = serviceOf(profile)
      const values = new Map<string, string>()
      let complete = true

      for (const [id] of providerEntries()) {
         for (const field of secretFields(id)) {
            const name = entryName(id, field)

            try {
               const stored = await Bun.secrets.get({ service, name })
               if (stored) values.set(name, stored)
            }
            catch (error) {
               this.#reportUnavailable('read', error)
               complete = false
            }
         }
      }

      return { values, complete }
   }

   async adopt(values: Map<string, string>): Promise<void> {
      for (const [id] of providerEntries()) {
         for (const field of secretFields(id)) {
            const value = values.get(entryName(id, field))
            if (value) await this.#write(id, field, value)
         }
      }
   }

   async migrate(): Promise<void> {
      for (const [id] of providerEntries()) {
         for (const field of secretFields(id)) {
            const stored = readStoredSecret(id, field)
            if (!stored) continue

            if (id === 'kraken' && field === 'apiKey') rememberKrakenAccount(stored)

            try {
               await Bun.secrets.set({ service: serviceOf(), name: entryName(id, field), value: stored })
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
