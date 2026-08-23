// The domain shapes the Kraken adapter produces, after Kraken's own naming has been
// normalized away. These are what the routes serve and the views read.

export interface PairAssets {
   baseAsset: string
   quoteAsset: string
}

export interface ResolvedPair extends PairAssets {
   pairKey: string
}

// Keyed by every name Kraken has ever used for a pair — result key, altname and
// wsname — so a lookup succeeds whichever the export wrote.
export type PairIndex = Map<string, PairAssets>

// What Kraken holds this second, and how much of it an open order has claimed.
export interface LiveBalance {
   asset: string
   total: string
   totalNum: number
   hold: string
   holdNum: number
}

export interface OpenOrder extends ResolvedPair {
   txid: string
   rawPair: string
   type: string
   ordertype: string
   description: string
   status: string
   oflags: string
   reference: number | string | null
   price: string
   volume: string
   executed: string
   remaining: string
   value: string
   opened: number
}

export type PairPrices = Record<string, number>

export type UsdRates = Record<string, number>

export interface CancelResult {
   count: number
}

// One row of Kraken's ledger export, ready to be stored. Amounts stay the exact
// decimal strings the export wrote.
export interface LedgerEntry {
   txid: string
   refid: string
   time: number
   type: string
   subtype: string
   aclass: string
   asset: string
   baseAsset: string
   wallet: string
   amount: string
   fee: string
   balance: string
}

// One row of Kraken's trades export. orderKey is the order id, or the trade's own
// id when Kraken wrote none — grouping on the bare column would collapse every
// order-less trade into one phantom order.
export interface Trade extends PairAssets {
   txid: string
   ordertxid: string
   orderKey: string
   pair: string
   pairKey: string
   time: number
   type: string
   ordertype: string
   price: string
   cost: string
   fee: string
   vol: string
   margin: string
   misc: string
}

export type ExportReportType = 'ledgers' | 'trades'

export interface ExportReport {
   id: string
   description: string
   status: string
   createdDate: number
   completedDate: number
}

export interface ExportRequest {
   report: ExportReportType
   description: string
   fromDate: number
   toDate?: number
}

export interface TokenizedListing {
   altname: string
   ticker: string
}

export interface TokenizedVolume {
   last: number | null
   volume24h: number
   volumeUsd24h: number | null
}

export interface LedgerFilters {
   asset?: string
   type?: string
   wallet?: string
   from?: number
   to?: number
   search?: string
}

export interface TradeFilters {
   pair?: string
   direction?: string
   ordertype?: string
   from?: number
   to?: number
   search?: string
}

export interface AggregationFilters {
   base?: string
   quote?: string
   includeAllQuotes?: boolean
   order?: 'asc' | 'desc'
   from?: number
   to?: number
}

export interface Sort {
   column?: string
   direction?: 'asc' | 'desc'
}
