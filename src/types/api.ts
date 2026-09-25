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
import type {
   FeeAmount, MovementKind, OrderSide, RunKind, RunOrderStatus, RunStatus, SizeUnit, SkipReason,
   StopSkipReason, StopStatus, VenueId
} from './portfolio'
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
   checkedAt: string
}

export type InstallMethod = 'homebrew' | 'scoop' | 'manual' | 'web'
export type InstallPlatform = 'macos' | 'windows' | 'linux' | 'other'

export interface InstallInfo {
   platform: InstallPlatform
   method: InstallMethod
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

export interface BalanceAsset {
   asset: string
   total: string
   totalNum: number
}

export interface BalanceSummary {
   assets: BalanceAsset[]
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
   isin: string
   underlyingIsin: string
   productUrl: string
   factsheetUrl: string
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
   // How far through its term the position is, which the page shows as progress.
   accrualDays: number
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

/* Bybit — portfolios */

export interface PortfolioTarget {
   asset: string
   weight: string
   stopPrice: string | null
}

export interface PortfolioStopState {
   orderLinkId: string
   asset: string
   symbol: string
   quantity: string
   triggerPrice: string
   status: StopStatus
   error: string | null
   placedAt: number
}

export interface PortfolioStopSkip {
   asset: string
   reason: StopSkipReason
}

export interface PortfolioStopFill {
   orderLinkId: string
   portfolioId: number
   portfolioName: string
   asset: string
   quantity: string
   proceeds: string
   averagePrice: string
   settledAt: number | null
}

export interface PortfolioHolding {
   asset: string
   quantity: string
   price: string | null
   value: string | null
   valueNum: number
   weight: string | null
   target: string
   drift: string | null
   unrealized: string | null
   unrealizedPercent: string | null
   realized: string
   stopPrice: string | null
   stopStatus: StopStatus | null
}

export interface PortfolioSummary {
   id: number
   name: string
   quoteAsset: string
   band: string
   createdAt: number
   targets: PortfolioTarget[]
   holdings: PortfolioHolding[]
   value: string
   valueNum: number
   netInvested: string
   profit: string
   realized: string
   unrealized: string
   unrealizedPercent: string | null
   closedRealized: string
   maxDrift: string
   needsRebalance: boolean
   lastRebalancedAt: number | null
   quoteLocked: boolean
   stops: PortfolioStopState[]
}

export interface AccountCoin {
   asset: string
   wallet: string
   free: string
   allocated: string
   unallocated: string
   value: string | null
   valueNum: number
   overallocated: boolean
}

export interface PortfolioKeyStatus {
   canTrade: boolean
   expiresAt: number | null
}

export interface PortfolioOverviewResponse {
   fetchedAt: number
   venue: VenueId
   accountId: string
   key: PortfolioKeyStatus
   valuationAsset: string
   coins: AccountCoin[]
   totalValue: string
   unallocatedValue: string
   portfolios: PortfolioSummary[]
   activeRun: { id: string, portfolioId: number } | null
   reconciled: number
   hardStops: boolean
   stopsSyncing: boolean
   stopFills: PortfolioStopFill[]
}

export interface PortfolioMarket {
   symbol: string
   base: string
   quote: string
}

export interface PortfolioMarketsResponse {
   quoteAssets: string[]
   markets: PortfolioMarket[]
}

export interface PortfolioSaveRequest {
   id?: number
   name: string
   quoteAsset: string
   band: string
   targets: PortfolioTarget[]
}

export interface PortfolioSaveResponse {
   id: number
}

export interface PortfolioArchiveRequest {
   portfolioId: number
}

export interface PortfolioArchiveResponse {
   archived: number
}

export interface PortfolioMovementRequest {
   portfolioId: number
   asset: string
   amount: string
   note?: string
}

export interface PortfolioMovement {
   id: number
   kind: MovementKind
   asset: string
   amount: string
   value: string
   orderLinkId: string | null
   note: string
   createdAt: number
}

export interface PortfolioMovementResponse {
   movement: PortfolioMovement
}

export interface PortfolioPlanRequest {
   portfolioId: number
   kind: RunKind
   amount?: string
   all?: boolean
   band?: string
   slippage?: string
}

export interface PortfolioPlanOrder {
   asset: string
   symbol: string
   side: OrderSide
   unit: SizeUnit
   amount: string
   price: string
   value: string
   fee: FeeAmount
   feeRate: string
   feeRateAssumed: boolean
}

export interface PortfolioPlanSkip {
   asset: string
   reason: SkipReason
   value: string
}

export interface PortfolioPlanResponse {
   planId: string
   portfolioId: number
   venue: VenueId
   kind: RunKind
   quoteAsset: string
   expiresAt: number
   band: string
   slippage: string
   total: string
   withdraw: string
   orders: PortfolioPlanOrder[]
   skipped: PortfolioPlanSkip[]
   cashAfter: string
   shortfall: string
   canTrade: boolean
}

export interface PortfolioExecuteRequest {
   planId: string
}

export interface PortfolioRunRequest {
   runId: string
}

export interface PortfolioRunOrder {
   orderLinkId: string
   seq: number
   symbol: string
   side: OrderSide
   unit: SizeUnit
   requested: string
   status: RunOrderStatus
   base: string
   quote: string
   averagePrice: string
   fees: FeeAmount[]
   error: string | null
}

export interface PortfolioRun {
   id: string
   portfolioId: number
   kind: RunKind
   status: RunStatus
   running: boolean
   withdraw: string
   withdrawn: string
   startedAt: number
   finishedAt: number | null
   error: string | null
   orders: PortfolioRunOrder[]
}

export interface PortfolioRunResponse {
   run: PortfolioRun
}

export interface PortfolioStopSyncRequest {
   portfolioId: number
}

export interface PortfolioStopSyncResponse {
   stops: PortfolioStopState[]
   skipped: PortfolioStopSkip[]
}

export interface PortfolioStopAckRequest {
   orderLinkId: string
}

export interface PortfolioStopAckResponse {
   acknowledged: number
}

export interface PortfolioHistoryRequest {
   portfolioId: number
}

export interface PortfolioHistoryResponse {
   movements: PortfolioMovement[]
   runs: PortfolioRun[]
}

export type { JobPhase }
