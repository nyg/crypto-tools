import BybitLayout from '../../components/bybit/bybit-layout'
import { bybitDemoVenue, bybitVenue } from '../../components/bybit/venues'
import InstantOrderPage from '../../components/instant-order/instant-order-page'

export default function BybitInstantOrder() {
   return <InstantOrderPage layout={BybitLayout} storageKey="bybit.instantOrder.venue" venues={[bybitVenue, bybitDemoVenue]} />
}
