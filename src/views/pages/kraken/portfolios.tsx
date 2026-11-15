import KrakenLayout from '../../components/kraken/kraken-layout'
import { krakenVenue } from '../../components/kraken/venues'
import PortfoliosPage from '../../components/portfolio/portfolios-page'

export default function KrakenPortfolios() {
   return (
      <PortfoliosPage
         layout={KrakenLayout}
         storageKey="kraken.portfolios.venue"
         venues={[
            {
               ...krakenVenue,
               quoteAsset: 'USD',
               chartExchange: 'KRAKEN',
               wallet: 'spot wallet',
               fees: 'Kraken charges every fee in the cash coin: each order the app places asks for it there.'
            }
         ]} />
   )
}
