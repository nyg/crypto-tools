import type { Provider } from './credentials'

// Where a credential actually came from, which the Settings page states rather than
// implies: the OS store is not always reachable, and the file is the fallback.
export type CredentialStore =
   'env' | 'keychain' | 'credential-manager' | 'keyring' | 'file' | 'none'

export type SecretField = 'apiKey' | 'apiSecret'

export interface ProviderSecrets {
   apiKey: string
   apiSecret: string
   store: CredentialStore
}

// What settings.json holds. The secrets are absent once they live in the OS credential
// store, and present only where storing them there failed.
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
