import type { HttpRequesterError } from '../../errors'
import type {
   CandleInterval, ExchangeAccount, LimitOrderRequest, OpenStopOrder, OrderLookup, OrderRequest, OrderSettlement,
   SpotCandle, SpotMarket, SpotPrice, StopOrderRequest, TradeFees, WalletCoin
} from '../../../types/portfolio'

export interface ChasePacing {
   pollMs: number
   moveAfterMs: number
}

export interface PortfolioExchange {
   readonly balanceDecimals: number
   readonly buyFeeInQuote: boolean
   readonly chasePacing: ChasePacing
   account(): Promise<ExchangeAccount>
   wallet(): Promise<WalletCoin[]>
   markets(): Promise<SpotMarket[]>
   prices(): Promise<Record<string, SpotPrice>>
   candles(symbol: string, interval: CandleInterval): Promise<SpotCandle[]>
   tradeFees?(symbols: string[]): Promise<Record<string, TradeFees>>
   placeOrder(order: OrderRequest): Promise<string>
   placeLimitOrder(order: LimitOrderRequest): Promise<string>
   cancelOrder(order: OrderLookup): Promise<void>
   settleOrder(order: OrderLookup): Promise<OrderSettlement | null>
   placeStopOrder(order: StopOrderRequest): Promise<string>
   cancelStopOrder(order: OrderLookup): Promise<void>
   openStopOrders(): Promise<OpenStopOrder[]>
   describeError(error: HttpRequesterError): string
   isAmbiguous(error: HttpRequesterError): boolean
   isPostOnlyRefusal(error: HttpRequesterError): boolean
}
