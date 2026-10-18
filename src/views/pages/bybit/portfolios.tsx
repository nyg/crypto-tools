import BybitLayout from '../../components/bybit/bybit-layout'
import PortfoliosPage from '../../components/portfolio/portfolios-page'
import { bybitDemoVenue, bybitVenue } from '../../components/bybit/venues'

const BYBIT_FEES = 'Bybit charges the fee on each order in the coin the order receives: the bought coin on a buy, the cash coin on a sell. An order cannot ask to pay it in cash.'

export default function BybitPortfolios() {
   return (
      <PortfoliosPage
         layout={BybitLayout}
         storageKey="bybit.portfolios.venue"
         venues={[
            {
               ...bybitVenue,
               quoteAsset: 'USDT',
               chartExchange: 'BYBIT',
               wallet: 'unified trading account',
               fees: BYBIT_FEES
            },
            {
               ...bybitDemoVenue,
               quoteAsset: 'USDT',
               chartExchange: 'BYBIT',
               wallet: 'unified trading account',
               fees: BYBIT_FEES,
               stopsNote: 'Demo trading drops resting orders after seven days, so a stop only protects a demo portfolio while the app runs often enough to place it again.'
            }
         ]} />
   )
}
