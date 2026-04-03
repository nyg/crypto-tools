import MenuLink from '../lib/menu-link'
import Layout from '../layout'


export default function SwissBorgLayout({ children, name }) {
   return (
      <Layout name={`SwissBorg ${name}`}>

         <header className="px-3 py-2 mb-4 flex items-baseline gap-x-3 border-b border-border">
            <MenuLink href="/swissborg/smart-yield">Smart Yield</MenuLink>
            <MenuLink href="/swissborg/community-index">Community Index</MenuLink>
         </header>

         <div className="px-3">
            {children}
         </div>

      </Layout>
   )
}
