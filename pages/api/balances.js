import Big from 'big.js'

import { spotService } from '../../core/spot-service'
import { stakingService } from '../../core/staking-service'


export default async function getBalances(req, res) {

   if (!req.body.apiKey || !req.body.apiSecret) {
      res.status(401)
      return
   }

   const apiCredentials = {
      apiKey: req.body.apiKey,
      apiSecret: req.body.apiSecret
   }

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
