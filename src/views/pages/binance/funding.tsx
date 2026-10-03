import BinanceLayout from '../../components/binance/binance-layout'
import FundingPage from '../../components/funding/funding-page'
import SettingsLink from '../../components/lib/settings-link'

export default function BinanceFunding() {
   return (
      <FundingPage
         layout={BinanceLayout}
         venue={{
            provider: 'binance',
            label: 'Binance',
            apiBase: '/api/binance/funding',
            syncs: true,
            setup: <>Create a Binance API key with Enable Reading, and add it in <SettingsLink group="Binance" /> under Binance.</>,
            empty: <>
               Nothing synced yet. A sync reads your deposits and withdrawals from Binance and keeps them in
               the database on this machine. The first one walks back to 2017 in 90-day steps, and Binance
               allows ten of those a minute for withdrawals, so it takes about four minutes. Later ones only
               read what is new.
            </>,
            note: <>
               Binance only serves about the last 90 days of fiat deposits and withdrawals through its API.
               Older ones stay here once a sync has read them, so sync at least that often to keep the fiat
               history whole.
            </>
         }} />
   )
}
