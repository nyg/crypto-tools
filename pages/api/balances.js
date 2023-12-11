import Big from 'big.js'

import { spotService } from '../../core/spot-service'
import { stakingService } from '../../core/staking-service'


export default async function getBalances({ body: { apiKey, apiSecret } }, res) {

   if (!apiKey || !apiSecret) {
      res.status(401).json({error: 'No API credentials provided.'})
      return
   }

   const apiCredentials = { apiKey, apiSecret}

   const spotBalance = await spotService.fetchSpotBalance(apiCredentials)
   const stakingPositions = await stakingService.fetchStakingBalance(apiCredentials)

   const assets = [...new Set(Object.keys(spotBalance).concat(Object.keys(stakingPositions)))]

   const balances = assets.map(asset => {
      const free = spotBalance[asset]?.free ?? Big(0)
      const locked = spotBalance[asset]?.locked ?? Big(0)
      const staked = stakingPositions[asset]?.balance ?? Big(0)
      return { asset, balance: free.add(locked).add(staked) }
   })

   const text = balances.map(balance => `${balance.asset}\t${balance.balance}`).join('\n')

   res.status(200).send(text)
}
