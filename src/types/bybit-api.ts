export interface BybitResponse<T> {
   retCode: number
   retMsg: string
   result: T
   time: number
}

export interface BybitPage<T> {
   category?: string
   list: T[]
   nextPageCursor?: string
}

export interface BybitSpotInstrument {
   symbol: string
   baseCoin: string
   quoteCoin: string
   status: string
   lotSizeFilter: {
      basePrecision: string
      quotePrecision: string
      minOrderQty: string
      maxOrderQty: string
      minOrderAmt: string
      maxOrderAmt: string
      maxMarketOrderQty?: string
   }
   priceFilter: {
      tickSize: string
   }
}

export interface BybitSpotTicker {
   symbol: string
   lastPrice: string
   bid1Price: string
   ask1Price: string
}

export interface BybitWalletCoin {
   coin: string
   walletBalance: string
   locked: string
   spotBorrow?: string
   borrowAmount?: string
}

export interface BybitWalletAccount {
   accountType: string
   coin: BybitWalletCoin[]
}

export interface BybitFeeRate {
   symbol: string
   takerFeeRate: string
   makerFeeRate: string
}

export interface BybitApiKeyInfo {
   readOnly: number
   permissions: Record<string, string[]>
   expiredAt: string
   userID: number
   userIDInt64?: string
}

export type BybitOrderSide = 'Buy' | 'Sell'

export interface BybitOrderBase {
   category: 'spot'
   symbol: string
   side: BybitOrderSide
   orderType: 'Market'
   qty: string
   marketUnit: 'baseCoin' | 'quoteCoin'
   isLeverage: 0
   orderLinkId: string
}

export interface BybitMarketOrderRequest extends BybitOrderBase {
   slippageToleranceType: 'Percent'
   slippageTolerance: string
}

export interface BybitStopOrderRequest extends BybitOrderBase {
   orderFilter: 'StopOrder'
   triggerPrice: string
}

export type BybitOrderRequest = BybitMarketOrderRequest | BybitStopOrderRequest

export interface BybitCancelRequest {
   category: 'spot'
   symbol: string
   orderFilter: 'StopOrder'
   orderLinkId: string
}

export interface BybitOrderCreated {
   orderId: string
   orderLinkId: string
}

export interface BybitOrderCancelled {
   orderId: string
   orderLinkId: string
}

export interface BybitOrder {
   orderId: string
   orderLinkId: string
   symbol: string
   side: BybitOrderSide
   orderStatus: string
   orderFilter?: string
   qty?: string
   triggerPrice?: string
   rejectReason?: string
   avgPrice: string
   cumExecQty: string
   cumExecValue: string
   cumExecFee: string
   cumFeeDetail?: Record<string, string> | null
}

export interface BybitExecution {
   orderId: string
   execQty: string
   execValue: string
   execFee: string
   feeCurrency: string
}

export type BybitEnvironment = 'mainnet' | 'demo'
