import type { HttpRequesterError } from '../../errors'
import type { StreamListener, StreamSubscription } from '../../adapters/websocket/socket-hub'
import type {
   CandleInterval, ExchangeAccount, LimitOrderRequest, OpenStopOrder, OrderEvent, OrderLookup, OrderRequest, OrderSettlement,
   SpotCandle, SpotMarket, SpotPrice, StopOrderRequest, TradeFees, WalletCoin
} from '../../../types/portfolio'

export interface ChasePacing {
   pollMs: number
   moveAfterMs: number
   pollsTakeTurns: boolean
}

export interface PortfolioExchange {
   readonly balanceDecimals: number
   readonly buyFeeInQuote: boolean
   readonly choosesFeeAsset?: boolean
   readonly chasePacing: ChasePacing
   account(): Promise<ExchangeAccount>
   wallet(): Promise<WalletCoin[]>
   markets(): Promise<SpotMarket[]>
   prices(): Promise<Record<string, SpotPrice>>
   candles(symbol: string, interval: CandleInterval): Promise<SpotCandle[]>
   tradeFees?(symbols: string[]): Promise<Record<string, TradeFees>>
   placeOrder(order: OrderRequest): Promise<string>
   placeLimitOrder(order: LimitOrderRequest): Promise<string>
   amendLimitPrice?(order: OrderLookup, price: string): Promise<void>
   cancelOrder(order: OrderLookup): Promise<void>
   settleOrder(order: OrderLookup): Promise<OrderSettlement | null>
   placeStopOrder(order: StopOrderRequest): Promise<string>
   cancelStopOrder(order: OrderLookup): Promise<void>
   openStopOrders(): Promise<OpenStopOrder[]>
   watchBook?(market: SpotMarket, listener: StreamListener<SpotPrice>): StreamSubscription
   watchOrders?(listener: StreamListener<OrderEvent>): StreamSubscription
   describeError(error: HttpRequesterError): string
   isAmbiguous(error: HttpRequesterError): boolean
   isPostOnlyRefusal(error: HttpRequesterError): boolean
}
