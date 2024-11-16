import MenuLink from '../lib/menu-link'
import Layout from '../layout'


export default function KrakenLayout({ children, name }) {
   return (
      <Layout name={`Kraken ${name}`}>

         <header className="px-3 py-2 mb-4 flex items-baseline gap-x-3 border-b">
            <MenuLink href="/kraken/order-batch">Order Batch</MenuLink>
            <MenuLink href="/kraken/closed-orders">Closed Orders</MenuLink>
            <MenuLink href="/kraken/balances">Balances</MenuLink>
         </header>

         <div className="px-3">
            {children}
         </div>

      </Layout>
   )
}
