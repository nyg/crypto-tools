import SubNav from '../lib/sub-nav'
import Layout from '../layout'
import { subNavItems } from '@/lib/tools'


const tabs = subNavItems('Kraken')

export default function KrakenLayout({ children, name }) {
   return (
      <Layout name={`Kraken ${name}`}>
         <SubNav items={tabs} />
         {children}
      </Layout>
   )
}
