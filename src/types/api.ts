// What the routes hand back over the wire. Amounts that need exact arithmetic cross
// as the decimal strings the repositories hold, never as floats; the *Num mirrors
// beside them exist for sorting and charting only.

import type {
   FeeAssetRow, FeeMonthRow, FeeTypeRow, LedgerEntryRow, MarketRow,
   OtherAccountRow, RewardPeriodRow, SyncStateRow, TradeListRow
} from './db'
import type { JobPhase, StartedJob, SyncJob, XStockJob } from './jobs'
import type { LiveBalance, OpenOrder, PairPrices, UsdRates } from './kraken'
import type { TradingPairs } from './market'
import type { XStockListingType } from './xstock'

export interface ErrorResponse {
   error: string
}

export interface Page {
   total: number
   page: number
   pageSize: number
}

export interface LatestRelease {
   version: string
   url: string
}

/* Kraken — live calls */

export interface BalancesResponse {
   fetchedAt: number
   assets: LiveBalance[]
   openOrders: OpenOrder[]
}

export interface OpenOrdersResponse {
   fetchedAt: number
   orders: OpenOrder[]
   prices: PairPrices
}

export interface AssetRatesResponse {
   rates: UsdRates
}

export type TradingPairsResponse = TradingPairs

/* Kraken — ledger */

export interface SyncState extends SyncStateRow {
   entryCount: number
   tradeCount: number
   orderCount: number
   dbSizeBytes: number
   otherAccounts: OtherAccountRow[]
}

export interface SyncStatusResponse {
   job: SyncJob | null
   state: SyncState
}

export type SyncStartResponse = StartedJob<SyncJob>

export interface SyncCancelResponse {
   job: SyncJob | null
}

export interface LedgerEntriesResponse extends Page {
   rows: LedgerEntryRow[]
}

export interface LedgerFiltersResponse {
   assets: string[]
   types: string[]
   wallets: string[]
}

export interface FeeSummary {
   assets: FeeAssetRow[]
   byType: FeeTypeRow[]
   byMonth: FeeMonthRow[]
   entries: number
}

export interface RewardAsset {
   asset: string
   total: number
   entries: number
   first: number
   last: number
   byYear: Record<number, number>
}

export interface RewardPeriod {
   from: number
   to: number
   assets: RewardPeriodRow[]
}

export interface RewardSummary {
   years: number[]
   periods: Record<string, RewardPeriod>
   assets: RewardAsset[]
   entries: number
   first: number | null
   last: number | null
}

export interface BalancePosition {
   wallet: string
   amount: string
   amountNum: number
   rawAssets: string[]
   entries: number
   first: number | null
   last: number | null
   lastRewardAt: number | null
   rewardEntries: number
}

export interface BalanceAsset {
   asset: string
   total: string
   totalNum: number
   positions: BalancePosition[]
}

export interface BalanceSummary {
   assets: BalanceAsset[]
   positions: number
   entries: number
   first: number | null
   last: number | null
}

export interface ClearResponse {
   entries: number
   trades: number
}

/* Kraken — trades */

export interface QuoteTotals {
   quoteAsset: string
   volume: string
   cost: string
   fee: string
   netCost: string
   price: string
}

export interface Order {
   orderId: string
   orderKey: string
   time: number
   tradeCount: number
   pair: string
   rawPair: string
   baseAsset: string
   quoteAsset: string
   direction: string
   ordertype: string
   volume: string
   cost: string
   fee: string
   netCost: string
   price: string
   margin: boolean
   misc: string
}

export interface Aggregation {
   groupKey: string
   direction: string
   startTime: number
   endTime: number
   baseAsset: string
   volume: string
   orderCount: number
   tradeCount: number
   pairs: string[]
   margin: boolean
   quotes: QuoteTotals[]
   orders: Order[]
}

export interface SummarySide {
   orderCount: number
   tradeCount: number
   volume: string
   quotes: QuoteTotals[]
}

export interface AggregationSummary {
   buy: SummarySide
   sell: SummarySide
}

export interface AggregationsResponse extends Page {
   rows: Aggregation[]
   baseAsset: string
   quoteAsset: string
   quoteAssets: string[]
   summary: AggregationSummary
   truncated: boolean
}

export interface TradesResponse extends Page {
   rows: TradeListRow[]
}

export interface TradeFiltersResponse {
   pairs: string[]
   directions: string[]
   ordertypes: string[]
   markets: MarketRow[]
}

/* Kraken — xStocks */

export interface XStockRow {
   altname: string
   ticker: string
   name: string
   exchange: string
   type: XStockListingType
   subtype: string
   confidence: string
   origin: string
   sources: string[]
   last: number | null
   volume24h: number | null
   volumeUsd24h: number | null
   description: string
}

export interface XStockListingsResponse {
   wordCount: number
   listings: XStockRow[]
}

export interface XStockJobResponse {
   job: XStockJob | null
}

export type XStockStartResponse = StartedJob<XStockJob | null>

/* Binance */

export interface StakingProductInfo {
   positionsAmount: string
   id: string
   apy: string
   duration: number
   soldOut: boolean
   minStakingAmount: string
   maxStakingAmount: string
}

export interface StakingPosition {
   id: string
   asset: string
   apy: string
   amount: string
   duration: number
   endDate: number
}

export interface StakingProduct {
   info: StakingProductInfo
   positions: StakingPosition[]
}

export interface AggregateBalanceRow {
   asset: string
   free: string
   locked: string
   total: string
   freeFiatValue: string
   fiatValue: string
   staking: {
      balance: string
      positions: StakingPosition[]
      products: StakingProduct[]
   }
}

export interface AggregateBalanceResponse {
   balance: AggregateBalanceRow[]
}

export type { JobPhase }
