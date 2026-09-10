import type { Provider } from './credentials'

export type CredentialStore =
   'env' | 'keychain' | 'credential-manager' | 'keyring' | 'file' | 'none'

export type SecretField = 'apiKey' | 'apiSecret'

export interface ProviderSecrets {
   apiKey: string
   apiSecret: string
   store: CredentialStore
}

export interface StoredProvider {
   apiKey?: string
   apiSecret?: string
}

export interface StoredSettings {
   version: number
   kraken: StoredProvider & { accountId: string }
   binance: StoredProvider
   anthropic: StoredProvider
}

export type SettingsUpdate = Partial<Record<Provider, Partial<Record<SecretField, string>>>>

// What the Settings route hands back: the keys themselves are replaced by a mask
// unless the form explicitly asks to reveal them.
export interface MaskedProvider {
   store: CredentialStore
   hasSecret: boolean
   apiKey: string
   apiSecret: string
   configured: boolean
   keyConfigured: boolean
}

export interface MaskedSettings {
   version: number
   kraken: MaskedProvider & { accountId: string }
   binance: MaskedProvider
   anthropic: MaskedProvider
}
