import { memo } from 'react'
import ExternalLink from './lib/external-link'
import MenuItem from './lib/menu-item'
import Link from 'next/link'


function Menu() {
   return (
      <>
         <MenuItem><Link href='/kraken/order-batch'>Kraken</Link></MenuItem>
         <MenuItem><Link href='/binance/staking'>Binance</Link></MenuItem>
         <MenuItem><Link href='/settings'>Settings</Link></MenuItem>
         <MenuItem><ExternalLink href="https://github.com/nyg/crypto-tools">Github</ExternalLink></MenuItem>
      </>
   )
}

export default memo(Menu)
