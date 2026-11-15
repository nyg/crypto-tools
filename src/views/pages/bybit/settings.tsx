import { settingsOf } from '@/lib/tools'

import BybitLayout from '../../components/bybit/bybit-layout'
import SettingsPage from '../../components/settings/settings-page'

const { providers } = settingsOf('Bybit')

export default function BybitSettings() {
   return <SettingsPage layout={BybitLayout} providers={providers} />
}
