import BybitLayout from '../../components/bybit/bybit-layout'
import FundingPage from '../../components/funding/funding-page'
import SettingsLink from '../../components/lib/settings-link'

export default function BybitFunding() {
   return (
      <FundingPage
         layout={BybitLayout}
         venue={{
            provider: 'bybit',
            label: 'Bybit',
            apiBase: '/api/bybit/funding',
            syncs: true,
            setup: <>Create a Bybit API key with the Read permission, and add it in <SettingsLink group="Bybit" /> under Bybit.</>,
            empty: <>
               Nothing synced yet. A sync reads your deposits and withdrawals from Bybit and keeps them in the
               database on this machine. The first one walks back to 2018 in 30-day steps and takes a minute
               or two. Later ones only read what is new.
            </>,
            note: <>
               Bybit&apos;s API lists crypto deposits and withdrawals, on-chain and between Bybit accounts.
               Fiat, card and P2P funding is not in it.
            </>
         }} />
   )
}
