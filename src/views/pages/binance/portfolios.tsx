import BinanceLayout from '../../components/binance/binance-layout'
import PortfoliosPage from '../../components/portfolio/portfolios-page'
import SettingsLink from '../../components/lib/settings-link'

const BINANCE_FEES = 'Binance charges the fee on each order in the coin the order receives, the bought coin on a buy and the cash coin on a sell, or in BNB when the account pays its fees with BNB. An order cannot ask to pay it in cash.'

export default function BinancePortfolios() {
   return (
      <PortfoliosPage
         layout={BinanceLayout}
         storageKey="binance.portfolios.venue"
         venues={[
            {
               id: 'binance',
               tab: 'Mainnet',
               label: 'Binance',
               apiBase: '/api/binance/portfolios',
               live: true,
               quoteAsset: 'USDT',
               wallet: 'spot wallet',
               fees: BINANCE_FEES,
               setup: <>Create a Binance API key with Enable Reading and Enable Spot & Margin Trading, and add it in <SettingsLink group="Binance" /> under Binance.</>
            },
            {
               id: 'binanceTestnet',
               tab: 'Testnet',
               label: 'Binance testnet',
               apiBase: '/api/binance/testnet/portfolios',
               live: false,
               quoteAsset: 'USDT',
               wallet: 'testnet account',
               fees: BINANCE_FEES,
               setup: <>Log in to testnet.binance.vision, generate an HMAC API key there, and add it in <SettingsLink group="Binance" /> under Binance testnet.</>,
               note: 'The spot testnet is reset about once a month, which wipes its balances and orders. Portfolios recorded before a reset no longer match the account; archive them and start again.'
            }
         ]} />
   )
}
