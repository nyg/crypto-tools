import type { ReactNode } from 'react'
import SubNav from '../lib/sub-nav'
import Layout from '../layout'
import { subNavItems } from '@/lib/tools'


const tabs = subNavItems('Binance')

export default function BinanceLayout({ children, name }: { children: ReactNode, name: string }) {
   return (
      <Layout name={`Binance ${name}`}>
         <SubNav items={tabs} />
         {children}
      </Layout>
   )
}
