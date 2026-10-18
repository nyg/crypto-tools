import BinanceLayout from '../../components/binance/binance-layout'
import InstantOrderPage from '../../components/instant-order/instant-order-page'
import { binanceTestnetVenue, binanceVenue } from '../../components/binance/venues'

export default function BinanceInstantOrder() {
   return <InstantOrderPage layout={BinanceLayout} storageKey="binance.instantOrder.venue" venues={[binanceVenue, binanceTestnetVenue]} />
}
