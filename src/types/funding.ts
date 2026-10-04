export type FundingVenueId = 'binance' | 'bybit'

export type FundingKind = 'deposit' | 'withdrawal'

export type FundingStatus = 'completed' | 'pending' | 'failed'

// Whatever the exchange calls its fields: a deposit's amount is what the exchange
// received, a withdrawal's what it sent out, and the fee what it kept on top.
export interface FundingRecord {
   id: string
   kind: FundingKind
   asset: string
   amount: string
   fee: string
   method: string
   status: FundingStatus
   time: number
}

export interface FundingWindow {
   from: number
   to: number
}
