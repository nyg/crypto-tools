import KrakenLayout from '../../components/kraken/kraken-layout'
import SettingsPage from '../../components/settings/settings-page'
import { settingsOf } from '@/lib/tools'

const { providers } = settingsOf('Kraken')

export default function KrakenSettings() {
   return <SettingsPage layout={KrakenLayout} providers={providers} />
}
