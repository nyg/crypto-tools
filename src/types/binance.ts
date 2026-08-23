import type Big from 'big.js'
import type { BinanceFiatOrder } from './binance-api'

// The domain shapes the Binance adapter produces. Amounts stay as Big here because
// the aggregate-balance route does arithmetic on them before serving them.

export interface SpotBalance {
   asset: string
   free: Big
   locked: Big
}

export type SpotBalances = Record<string, SpotBalance>

export interface StakingPositionAmount {
   id: string
   asset: string
   apy: string
   amount: Big
   duration: number
   endDate: number
}

export interface StakingBalance {
   balance: Big
   positions: StakingPositionAmount[]
}

export type StakingBalances = Record<string, StakingBalance>

export interface StakingProductDetail {
   id: string
   apy: string
   duration: number
   soldOut: boolean
   minStakingAmount: string
   maxStakingAmount: string
}

export type StakingProducts = Record<string, StakingProductDetail[]>

export type PairRates = Record<string, Big>

export interface Candlestick {
   timestamp: { open: number, close: number }
   open: string
   high: string
   low: string
   close: string
   volume: { base: string, quote: string }
   tradeCount: number
}

export type FiatDeposit = BinanceFiatOrder
