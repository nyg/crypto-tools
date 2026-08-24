// The shapes Binance's REST API and its undocumented earn gateway return.

export interface BinanceSymbol {
   symbol: string
   baseAsset: string
   quoteAsset: string
   baseAssetPrecision: number
   quoteAssetPrecision: number
}

export interface BinanceExchangeInfo {
   symbols: BinanceSymbol[]
}

export interface BinanceTickerPrice {
   symbol: string
   price: string
}

// [openTime, open, high, low, close, baseVolume, closeTime, quoteVolume, tradeCount, …]
export type BinanceKLine = [
   number, string, string, string, string, string, number, string, number, ...unknown[]
]

export interface BinanceSpotBalance {
   asset: string
   free: string
   locked: string
}

export interface BinanceStakingPosition {
   positionId: string
   asset: string
   amount: string
   apy: string
   duration: number
   accrualDays: number
   deliverDate: number
}

export interface BinanceFiatOrder {
   orderNo: string
   fiatCurrency: string
   indicatedAmount: string
   amount: string
   status: string
   createTime: number
}

export interface BinanceFiatFunding {
   data: BinanceFiatOrder[]
   total: number
}

export interface BinanceEarnProductDetail {
   productId: string
   apy: string
   duration: number
   sellOut: boolean
   minPurchaseAmount: string
   maxPurchaseAmountPerUser: string
}

export interface BinanceEarnProduct {
   asset: string
   productDetailList: BinanceEarnProductDetail[]
}

export interface BinanceSimpleEarnProducts {
   data: {
      list: BinanceEarnProduct[]
      total: number
   }
}

export interface BinanceSimpleEarnParams {
   pageIndex: number
   pageSize: number
   simpleEarnType: string
}
