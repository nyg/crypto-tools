import type { ReactNode } from 'react'
import SubNav from '../lib/sub-nav'
import Layout from '../layout'
import { subNavItems } from '@/lib/tools'


const tabs = subNavItems('Bybit')

export default function BybitLayout({
   children, name, trailing
}: { children: ReactNode, name: string, trailing?: ReactNode }) {
   return (
      <Layout name={`Bybit ${name}`}>
         <SubNav items={tabs} trailing={trailing} />
         {children}
      </Layout>
   )
}
