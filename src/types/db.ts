import type { XStockType } from './xstock'

// The row shapes the repositories read back out of SQLite. Column names are aliased
// in the queries, so these describe the aliases rather than the schema.

export interface CountRow {
   count: number
}

export interface TimeRangeRow {
   first: number | null
   last: number | null
}

export interface ValueRow {
   value: string
}

export interface UserVersionRow {
   user_version: number
}

export interface LedgerEntryRow {
   txid: string
   refid: string
   time: number
   type: string
   subtype: string
   asset: string
   baseAsset: string
   wallet: string
   amount: string
   fee: string
   balance: string
}

export interface FeeAssetRow {
   asset: string
   total: number
   entries: number
}

export interface FeeTypeRow extends FeeAssetRow {
   type: string
}

export interface FeeMonthRow extends FeeTypeRow {
   month: string
}

export interface RewardRow {
   asset: string
   year: number
   total: number
   entries: number
   first: number
   last: number
}

export interface RewardPeriodRow {
   asset: string
   total: number
   entries: number
}

export interface BalanceAmountRow {
   baseAsset: string
   wallet: string
   rawAsset: string
   amount: string
   fee: string
}

export interface BalanceCountRow {
   baseAsset: string
   wallet: string
   entries: number
   first: number
   last: number
}

export interface BalanceRewardRow {
   baseAsset: string
   wallet: string
   lastRewardAt: number
   rewardEntries: number
}

export interface SyncStateRow {
   accountId: string
   apiKeyPrefix: string
   coveredFrom: number | null
   coveredTo: number | null
   tradesCoveredFrom: number | null
   tradesCoveredTo: number | null
   firstSyncedAt: number | null
   lastSyncedAt: number | null
   lastReportId: string | null
   lastError: string | null
}

export type SyncStateUpdate = Partial<Omit<SyncStateRow, 'accountId'>>

export interface OtherAccountRow {
   accountId: string
   apiKeyPrefix: string
   entryCount: number
}

export interface TradeRow {
   orderKey: string
   txid: string
   ordertxid: string
   time: number
   type: string
   ordertype: string
   pair: string
   pairKey: string
   baseAsset: string
   quoteAsset: string
   price: string
   cost: string
   fee: string
   vol: string
   margin: string
   misc: string
}

export interface TradeListRow {
   txid: string
   orderId: string
   orderKey: string
   time: number
   pair: string
   rawPair: string
   baseAsset: string
   quoteAsset: string
   direction: string
   ordertype: string
   price: string
   cost: string
   fee: string
   volume: string
   margin: string
   misc: string
}

export interface MarketRow {
   pairKey: string
   baseAsset: string
   quoteAsset: string
}

export interface XStockListingRow {
   ticker: string
   altname: string
   name: string
   exchange: string
   // Only ever written from XStockClassification, so the column holds nothing else.
   type: XStockType
   subtype: string
   confidence: string
   sources: string
   origin: string
   classifiedAt: number
}

export interface XStockDescriptionRow {
   ticker: string
   description: string
   sources: string
   generatedAt: number
}
