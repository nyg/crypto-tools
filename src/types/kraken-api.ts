// The shapes Kraken's REST API actually returns. Every private endpoint wraps its
// payload in { error, result }; the requester rejects when error is non-empty, so a
// resolved response always carries a result.

export interface KrakenResponse<T> {
   error: string[]
   result: T
}

export interface KrakenAssetPair {
   altname: string
   wsname?: string
   base: string
   quote: string
   lot_decimals: number
   cost_decimals: number
   status?: string
}

export type KrakenAssetPairs = Record<string, KrakenAssetPair>

export interface KrakenAsset {
   altname: string
   aclass: string
   decimals: number
   status?: string
}

export type KrakenAssets = Record<string, KrakenAsset>

export interface KrakenTickerEntry {
   // [price, whole lot volume, lot volume] — only the last trade price is read here.
   c?: string[]
   v?: string[]
   p?: string[]
}

export type KrakenTicker = Record<string, KrakenTickerEntry>

export interface KrakenBalanceEntry {
   balance?: string
   hold_trade?: string
}

export type KrakenExtendedBalance = Record<string, KrakenBalanceEntry>

export interface KrakenOrderDescription {
   pair?: string
   type?: string
   ordertype?: string
   price?: string
   order?: string
}

export interface KrakenOpenOrder {
   descr?: KrakenOrderDescription
   vol?: string
   vol_exec?: string
   status?: string
   oflags?: string
   userref?: number | null
   cl_ord_id?: string | null
   opentm?: number
}

export interface KrakenOpenOrders {
   open?: Record<string, KrakenOpenOrder>
}

export interface KrakenCancelResult {
   count?: number
}

export interface KrakenAddOrderBatchResult {
   orders: unknown[]
}

export interface KrakenAddExportResult {
   id: string
}

export interface KrakenExportStatusEntry {
   id: string
   descr?: string
   status?: string
   createdtm: string | number
   completedtm: string | number
}

export type KrakenExportStatus = KrakenExportStatusEntry[]

// The websocket ticker channel, used for the 24h volumes of tokenized assets.
export interface KrakenTickerSnapshot {
   symbol: string
   last?: number
   volume?: number
   vwap?: number
}

export interface KrakenOrderBatchOrder {
   volume: string | number
   price: string | number
}

export interface KrakenOrderBatchParams {
   pair: string
   direction: string
   dryRun?: boolean
   userref?: number | null
   orders: KrakenOrderBatchOrder[]
}
