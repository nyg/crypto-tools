import { useEffect } from 'react'
import MenuLink from './lib/menu-link'


const isActive = (path, href) => path.split('/')[1] === href.split('/')[1]

export default function Layout({ children, name }) {

   useEffect(() => {
      document.title = `Crypto Tools — ${name}`
   }, [name])

   return (
      <div className="flex flex-col px-12 pb-12">

         <header className="px-3 pb-2 mt-4 flex items-baseline gap-x-3 border-b border-border">
            <h1 className="text-xl">Crypto Tools</h1>
            <span className="grow"></span>
            <MenuLink href="/kraken/order-batch" isActive={isActive}>Kraken</MenuLink>
            <MenuLink href="/binance/staking" isActive={isActive}>Binance</MenuLink>
            <MenuLink href="/settings" isActive={isActive}>Settings</MenuLink>
            <span className="text-xs text-muted-foreground">•</span>
            <MenuLink href="https://github.com/nyg/crypto-tools">Github</MenuLink>
         </header>

         <main>
            {children}
         </main>

      </div>
   )
}
