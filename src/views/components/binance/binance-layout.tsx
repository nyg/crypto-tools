import type { ReactNode } from 'react'

import { subNavItems } from '@/lib/tools'

import Layout from '../layout'
import SubNav from '../lib/sub-nav'


const tabs = subNavItems('Binance')

export default function BinanceLayout({
   children, name, trailing
}: { children: ReactNode, name: string, trailing?: ReactNode }) {
   return (
      <Layout name={`Binance ${name}`} subNav={<SubNav items={tabs} trailing={trailing} />}>
         {children}
      </Layout>
   )
}
