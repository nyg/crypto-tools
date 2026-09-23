// The shapes Binance's REST API and its undocumented earn gateway return.

export type BinanceEnvironment = 'mainnet' | 'testnet'

export interface BinanceSymbolFilter {
   filterType: string
   minQty?: string
   maxQty?: string
   stepSize?: string
   tickSize?: string
   minNotional?: string
   maxNotional?: string
}

export interface BinanceSymbol {
   symbol: string
   baseAsset: string
   quoteAsset: string
   baseAssetPrecision: number
   quoteAssetPrecision: number
   status?: string
   isSpotTradingAllowed?: boolean
   orderTypes?: string[]
   filters?: BinanceSymbolFilter[]
}

export interface BinanceExchangeInfo {
   symbols: BinanceSymbol[]
}

export interface BinanceTickerPrice {
   symbol: string
   price: string
}

export interface BinanceBookTicker {
   symbol: string
   bidPrice: string
   askPrice: string
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

export interface BinanceAccount {
   uid?: number
   canTrade: boolean
   balances: BinanceSpotBalance[]
}

export type BinanceOrderSide = 'BUY' | 'SELL'

export interface BinanceOrderParams {
   symbol: string
   side: BinanceOrderSide
   type: 'MARKET' | 'STOP_LOSS'
   quantity?: string
   quoteOrderQty?: string
   stopPrice?: string
   newClientOrderId: string
   newOrderRespType: 'ACK'
}

export interface BinanceOrderReference {
   symbol: string
   origClientOrderId: string
}

export interface BinanceCommissionRates {
   maker?: string
   taker?: string
   buyer?: string
   seller?: string
}

export interface BinanceCommission {
   symbol: string
   standardCommission?: BinanceCommissionRates
   specialCommission?: BinanceCommissionRates
   taxCommission?: BinanceCommissionRates
}

export interface BinanceOrderAck {
   symbol: string
   orderId: number
   clientOrderId: string
}

export interface BinanceOrder {
   symbol: string
   orderId: number
   clientOrderId: string
   status: string
   type: string
   side: BinanceOrderSide
   origQty: string
   executedQty: string
   cummulativeQuoteQty: string
   stopPrice?: string
}

export interface BinanceTrade {
   orderId: number
   commission: string
   commissionAsset: string
}

export interface BinanceErrorBody {
   code: number
   msg: string
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
