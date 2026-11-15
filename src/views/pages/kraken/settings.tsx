import { settingsOf } from '@/lib/tools'

import KrakenLayout from '../../components/kraken/kraken-layout'
import SettingsPage from '../../components/settings/settings-page'

const { providers } = settingsOf('Kraken')

export default function KrakenSettings() {
   return <SettingsPage layout={KrakenLayout} providers={providers} />
}
