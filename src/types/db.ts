import type { MovementKind, OrderSide, RunKind, RunOrderStatus, RunStatus, SizeUnit, StopStatus } from './portfolio'
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

export interface UsdValue {
   value: number | null
   unvalued: number
}

export interface FeeAssetRow extends UsdValue {
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

export interface RewardRow extends UsdValue {
   asset: string
   year: number
   total: number
   entries: number
   first: number
   last: number
}

export interface RewardBucketRow extends UsdValue {
   asset: string
   start: number
   total: number
}

export interface RewardPeriodRow extends UsdValue {
   asset: string
   total: number
   entries: number
}

export type UsdRateSource = 'kraken-daily' | 'kraken-weekly' | 'ecb' | 'binance-daily'

export interface UsdRateRow {
   asset: string
   day: number
   rate: number
   source: UsdRateSource
}

export interface AssetRangeRow {
   asset: string
   first: number
   last: number
}

export interface BalanceAmountRow {
   baseAsset: string
   amount: string
   fee: string
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

export interface PortfolioRow {
   id: number
   name: string
   quoteAsset: string
   band: string
   createdAt: number
}

export interface PortfolioTargetRow {
   portfolioId: number
   asset: string
   weight: string
   stopPrice: string | null
}

export interface PortfolioStopRow {
   orderLinkId: string
   portfolioId: number
   asset: string
   symbol: string
   quantity: string
   triggerPrice: string
   orderId: string | null
   status: StopStatus
   error: string | null
   placedAt: number
   updatedAt: number
   settledAt: number | null
   acknowledgedAt: number | null
}

export interface PortfolioMovementRow {
   id: number
   portfolioId: number
   kind: MovementKind
   asset: string
   amount: string
   value: string
   orderLinkId: string | null
   note: string
   createdAt: number
}

export interface PortfolioRunRow {
   id: string
   portfolioId: number
   kind: RunKind
   status: RunStatus
   withdraw: string
   withdrawn: string
   reserve: string
   slippage: string
   error: string | null
   startedAt: number
   finishedAt: number | null
}

export interface PortfolioOrderRow {
   orderLinkId: string
   runId: string
   portfolioId: number
   seq: number
   symbol: string
   side: OrderSide
   baseAsset: string
   quoteAsset: string
   unit: SizeUnit
   requested: string
   orderId: string | null
   status: RunOrderStatus
   base: string
   quote: string
   averagePrice: string
   error: string | null
   createdAt: number
   updatedAt: number
}
