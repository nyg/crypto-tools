import SubNav from '../lib/sub-nav'
import Layout from '../layout'
import { subNavItems } from '@/lib/tools'


const tabs = subNavItems('Tools')

export default function ToolsLayout({ children, name }) {
   return (
      <Layout name={name}>
         <SubNav items={tabs} />
         {children}
      </Layout>
   )
}
