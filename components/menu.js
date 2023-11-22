import ExternalLink from './lib/external-link'
import MenuItem from './lib/menu-item'
import Link from 'next/link'


export default function Menu() {
   return (
      <>
         <MenuItem><Link href='/kraken'>Kraken</Link></MenuItem>
         <MenuItem><Link href='/binance'>Binance</Link></MenuItem>
         <MenuItem><Link href='/settings'>Settings</Link></MenuItem>
         <MenuItem><ExternalLink href="https://github.com/nyg/crypto-tools">Github</ExternalLink></MenuItem>
      </>
   )
}
