import InstantOrderPage from '../../components/instant-order/instant-order-page'
import KrakenLayout from '../../components/kraken/kraken-layout'
import { krakenVenue } from '../../components/kraken/venues'

export default function KrakenInstantOrder() {
   return <InstantOrderPage layout={KrakenLayout} storageKey="kraken.instantOrder.venue" venues={[krakenVenue]} />
}
