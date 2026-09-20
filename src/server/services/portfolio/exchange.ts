import type {
   ExchangeAccount, OpenStopOrder, OrderRequest, OrderSettlement, SpotMarket, SpotPrice,
   StopOrderRequest, WalletCoin
} from '../../../types/portfolio'

export interface PortfolioExchange {
   readonly balanceDecimals: number
   account(): Promise<ExchangeAccount>
   wallet(): Promise<WalletCoin[]>
   markets(): Promise<SpotMarket[]>
   prices(): Promise<Record<string, SpotPrice>>
   placeOrder(order: OrderRequest): Promise<string>
   settleOrder(clientOrderId: string): Promise<OrderSettlement | null>
   placeStopOrder(order: StopOrderRequest): Promise<string>
   cancelStopOrder(symbol: string, clientOrderId: string): Promise<void>
   openStopOrders(): Promise<OpenStopOrder[]>
}
