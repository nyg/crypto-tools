import SubNav from '../lib/sub-nav'
import Layout from '../layout'


const tabs = [
   { label: 'Staking', href: '/binance/staking' }
]

export default function BinanceLayout({ children, name }) {
   return (
      <Layout name={`Binance ${name}`}>
         <SubNav items={tabs} />
         {children}
      </Layout>
   )
}
