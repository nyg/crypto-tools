import type {
   ExchangeAccount, OrderRequest, OrderSettlement, SpotMarket, SpotPrice, WalletCoin
} from '../../../types/portfolio'

export interface PortfolioExchange {
   readonly balanceDecimals: number
   account(): Promise<ExchangeAccount>
   wallet(): Promise<WalletCoin[]>
   markets(): Promise<SpotMarket[]>
   prices(): Promise<Record<string, SpotPrice>>
   placeOrder(order: OrderRequest): Promise<string>
   settleOrder(clientOrderId: string): Promise<OrderSettlement | null>
}
