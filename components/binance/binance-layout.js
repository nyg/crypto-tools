import MenuLink from '../lib/menu-link'
import Layout from '../layout'


export default function BinanceLayout({ children, name }) {
   return (
      <Layout name={`Binance ${name}`}>

         <header className="px-3 py-2 mb-4 flex items-baseline gap-x-3 border-b">
            <MenuLink href="/binance/staking">Staking</MenuLink>
         </header>

         {children}
      </Layout>
   )
}
