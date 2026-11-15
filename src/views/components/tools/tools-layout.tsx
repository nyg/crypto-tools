import type { ReactNode } from 'react'

import { subNavItems } from '@/lib/tools'

import Layout from '../layout'
import SubNav from '../lib/sub-nav'


const tabs = subNavItems('Tools')

export default function ToolsLayout({ children, name }: { children: ReactNode, name: string }) {
   return (
      <Layout name={name} subNav={<SubNav items={tabs} />}>
         {children}
      </Layout>
   )
}
