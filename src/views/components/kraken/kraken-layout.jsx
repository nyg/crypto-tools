import SubNav from '../lib/sub-nav'
import Layout from '../layout'


const tabs = [
   { label: 'Order Batch', href: '/kraken/order-batch' },
   { label: 'Closed Orders', href: '/kraken/closed-orders' },
   { label: 'Ledger', href: '/kraken/ledger' },
   { label: 'Balances', href: '/kraken/balances' },
   { label: 'xStocks', href: '/kraken/xstocks' }
]

export default function KrakenLayout({ children, name }) {
   return (
      <Layout name={`Kraken ${name}`}>
         <SubNav items={tabs} />
         {children}
      </Layout>
   )
}
