export type Provider = 'kraken' | 'binance' | 'anthropic'

export interface Credentials {
   apiKey: string
   apiSecret: string
}

export interface AuthenticatedRequest {
   url: string
   searchParams?: Record<string, unknown>
   bodyParams?: unknown
   headers?: Record<string, string>
}

export type Authenticator = (request: AuthenticatedRequest) => Promise<AuthenticatedRequest>
