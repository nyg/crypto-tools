import type { HttpRequesterError } from '../../errors'
import type {
   CandleInterval, ExchangeAccount, OpenStopOrder, OrderLookup, OrderRequest, OrderSettlement, SpotCandle,
   SpotMarket, SpotPrice, StopOrderRequest, TakerFee, WalletCoin
} from '../../../types/portfolio'

export interface PortfolioExchange {
   readonly balanceDecimals: number
   readonly buyFeeInQuote: boolean
   account(): Promise<ExchangeAccount>
   wallet(): Promise<WalletCoin[]>
   markets(): Promise<SpotMarket[]>
   prices(): Promise<Record<string, SpotPrice>>
   candles(symbol: string, interval: CandleInterval): Promise<SpotCandle[]>
   takerFees?(symbols: string[]): Promise<Record<string, TakerFee>>
   placeOrder(order: OrderRequest): Promise<string>
   settleOrder(order: OrderLookup): Promise<OrderSettlement | null>
   placeStopOrder(order: StopOrderRequest): Promise<string>
   cancelStopOrder(order: OrderLookup): Promise<void>
   openStopOrders(): Promise<OpenStopOrder[]>
   describeError(error: HttpRequesterError): string
   isAmbiguous(error: HttpRequesterError): boolean
}
