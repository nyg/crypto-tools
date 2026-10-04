import { Link } from 'react-router'
import KrakenLayout from '../../components/kraken/kraken-layout'
import FundingPage from '../../components/funding/funding-page'
import SettingsLink from '../../components/lib/settings-link'
import { assetLabel } from '../../components/kraken/asset-migrations'

export default function KrakenFunding() {
   return (
      <FundingPage
         layout={KrakenLayout}
         venue={{
            provider: 'kraken',
            label: 'Kraken',
            apiBase: '/api/kraken/ledger/funding',
            syncs: false,
            assetLabel,
            setup: <>Generate an API key and secret on Kraken and add them in <SettingsLink group="Kraken" /> to sync your ledger.</>,
            empty: <>
               No deposit or withdrawal in the stored ledger. Sync your ledger on the{' '}
               <Link to="/kraken/ledger" className="font-medium text-foreground underline underline-offset-4">
                  Ledger
               </Link>{' '}
               tab first, then come back.
            </>
         }} />
   )
}
