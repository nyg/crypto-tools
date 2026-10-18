import BinanceLayout from '../../components/binance/binance-layout'
import PortfoliosPage from '../../components/portfolio/portfolios-page'
import { binanceTestnetVenue, binanceVenue } from '../../components/binance/venues'

const BINANCE_FEES = 'Binance charges the fee on each order in the coin the order receives, the bought coin on a buy and the cash coin on a sell, or in BNB when the account pays its fees with BNB. An order cannot ask to pay it in cash.'

export default function BinancePortfolios() {
   return (
      <PortfoliosPage
         layout={BinanceLayout}
         storageKey="binance.portfolios.venue"
         venues={[
            {
               ...binanceVenue,
               quoteAsset: 'USDT',
               chartExchange: 'BINANCE',
               wallet: 'spot wallet',
               fees: BINANCE_FEES
            },
            {
               ...binanceTestnetVenue,
               quoteAsset: 'USDT',
               chartExchange: 'BINANCE',
               wallet: 'testnet account',
               fees: BINANCE_FEES,
               note: 'The spot testnet is reset about once a month, which wipes its balances and orders. Portfolios recorded before a reset no longer match the account; archive them and start again.'
            }
         ]} />
   )
}
