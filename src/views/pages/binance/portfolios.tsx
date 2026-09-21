import BinanceLayout from '../../components/binance/binance-layout'
import PortfoliosPage from '../../components/portfolio/portfolios-page'

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
               setup: 'Create a Binance API key with Enable Reading and Enable Spot & Margin Trading, and add it in Settings under Binance.'
            },
            {
               id: 'binanceTestnet',
               tab: 'Testnet',
               label: 'Binance testnet',
               apiBase: '/api/binance/testnet/portfolios',
               live: false,
               quoteAsset: 'USDT',
               wallet: 'testnet account',
               setup: 'Log in to testnet.binance.vision, generate an HMAC API key there, and add it in Settings under Binance testnet.',
               note: 'The spot testnet is reset about once a month, which wipes its balances and orders. Portfolios recorded before a reset no longer match the account; archive them and start again.'
            }
         ]} />
   )
}
