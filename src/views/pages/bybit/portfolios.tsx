import BybitLayout from '../../components/bybit/bybit-layout'
import PortfoliosPage from '../../components/portfolio/portfolios-page'

export default function BybitPortfolios() {
   return (
      <PortfoliosPage
         layout={BybitLayout}
         storageKey="bybit.portfolios.venue"
         venues={[
            {
               id: 'bybit',
               tab: 'Mainnet',
               label: 'Bybit',
               apiBase: '/api/bybit/portfolios',
               live: true,
               quoteAsset: 'USDT',
               wallet: 'unified trading account',
               setup: 'Create a Bybit API key with the Read and Spot trade permissions, and add it in Settings under Bybit.'
            },
            {
               id: 'bybitDemo',
               tab: 'Demo',
               label: 'Bybit demo',
               apiBase: '/api/bybit/demo/portfolios',
               live: false,
               quoteAsset: 'USDT',
               wallet: 'unified trading account',
               setup: 'Switch Bybit to demo trading, create an API key there, and add it in Settings under Bybit demo trading.',
               stopsNote: 'Demo trading drops resting orders after seven days, so a stop only protects a demo portfolio while the app runs often enough to place it again.'
            }
         ]} />
   )
}
