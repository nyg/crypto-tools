import type { Provider } from './credentials'

export type CredentialSource = 'env' | 'file'

// apiSecret is absent for a provider that has none (Anthropic), and source is filled
// in by readSettings rather than stored, so both are optional on the shape as written.
export interface ProviderSettings {
   apiKey: string
   apiSecret?: string
   source?: CredentialSource
}

export interface Settings {
   version: number
   kraken: ProviderSettings & { accountId: string }
   binance: ProviderSettings
   anthropic: ProviderSettings
}

export type SettingsUpdate = Partial<Record<Provider, Partial<ProviderSettings>>>

// What the Settings route hands back: the keys themselves are replaced by a mask
// unless the form explicitly asks to reveal them.
export interface MaskedProvider {
   source: CredentialSource
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
