import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import SubNav from '../lib/sub-nav'
import Layout from '../layout'
import SyncNavStatus from './sync-nav-status'
import { ledgerBackedPaths, subNavItems } from '@/lib/tools'


const tabs = subNavItems('Kraken')

// A page that reads Kraken live carries its own freshness — when it last called, and
// the button to call again — so it passes that instead. The ledger watermark is only
// shown where the page is actually served from the ledger.
export default function KrakenLayout({
   children, name, trailing
}: { children: ReactNode, name: string, trailing?: ReactNode }) {

   const { pathname } = useLocation()

   return (
      <Layout name={`Kraken ${name}`}>
         <SubNav
            items={tabs}
            trailing={trailing ?? (ledgerBackedPaths.has(pathname) ? <SyncNavStatus /> : null)} />
         {children}
      </Layout>
   )
}
