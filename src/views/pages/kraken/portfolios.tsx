import KrakenLayout from '../../components/kraken/kraken-layout'
import PortfoliosPage from '../../components/portfolio/portfolios-page'
import SettingsLink from '../../components/lib/settings-link'

export default function KrakenPortfolios() {
   return (
      <PortfoliosPage
         layout={KrakenLayout}
         storageKey="kraken.portfolios.venue"
         venues={[
            {
               id: 'kraken',
               tab: 'Mainnet',
               label: 'Kraken',
               apiBase: '/api/kraken/portfolios',
               live: true,
               quoteAsset: 'USD',
               wallet: 'spot wallet',
               setup: <>Create a Kraken API key with the Query Funds, Query Open Orders & Trades, Query Closed Orders & Trades, Create & Modify Orders and Cancel/Close Orders permissions, and add it in <SettingsLink group="Kraken" /> under Kraken.</>
            }
         ]} />
   )
}
