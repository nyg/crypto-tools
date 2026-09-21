import BinanceLayout from '../../components/binance/binance-layout'
import SettingsPage from '../../components/settings/settings-page'
import { settingsOf } from '@/lib/tools'

const { providers } = settingsOf('Binance')

export default function BinanceSettings() {
   return <SettingsPage layout={BinanceLayout} providers={providers} />
}
