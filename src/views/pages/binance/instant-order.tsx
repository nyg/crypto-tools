import BinanceLayout from '../../components/binance/binance-layout'
import { binanceTestnetVenue, binanceVenue } from '../../components/binance/venues'
import InstantOrderPage from '../../components/instant-order/instant-order-page'

export default function BinanceInstantOrder() {
   return <InstantOrderPage layout={BinanceLayout} storageKey="binance.instantOrder.venue" venues={[binanceVenue, binanceTestnetVenue]} />
}
