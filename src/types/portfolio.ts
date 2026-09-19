export type VenueId = 'bybit' | 'bybitDemo'

export type OrderSide = 'buy' | 'sell'

export type SizeUnit = 'base' | 'quote'

export interface SpotMarket {
   symbol: string
   base: string
   quote: string
   baseStep: string
   quoteStep: string
   minQty: string
   minAmount: string
   maxQty: string
   maxAmount: string
}

export interface SpotPrice {
   last: string
   bid: string
   ask: string
}

export interface WalletCoin {
   asset: string
   total: string
   free: string
   borrowed: string
}

export interface ExchangeAccount {
   accountId: string
   canTrade: boolean
   expiresAt: number | null
}

export interface OrderRequest {
   clientOrderId: string
   symbol: string
   side: OrderSide
   unit: SizeUnit
   amount: string
   maxSlippagePercent: string
}

export type SettlementStatus = 'open' | 'filled' | 'partial' | 'rejected'

export interface OrderSettlement {
   orderId: string
   status: SettlementStatus
   base: string
   quote: string
   averagePrice: string
   fees: Record<string, string>
   reason: string
}

export type SkipReason =
   'within-band' | 'below-minimum' | 'no-market' | 'unpriced' | 'no-free-balance' | 'no-cash'

export type MovementKind = 'deposit' | 'withdraw' | 'adjust' | 'fee'

export type RunKind = 'rebalance' | 'withdraw'

export type RunStatus = 'running' | 'done' | 'partial' | 'error' | 'interrupted'

export type RunOrderStatus =
   'pending' | 'placed' | 'filled' | 'partial' | 'rejected' | 'failed' | 'skipped' | 'unknown'

export interface FeeAmount {
   asset: string
   amount: string
}
