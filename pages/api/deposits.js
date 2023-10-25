import { spotService } from '../../core/spot-service'


export default async function getDeposits(req, res) {

   if (!req.body.apiKey || !req.body.apiSecret) {
      res.status(401)
      return
   }

   const apiCredentials = {
      apiKey: req.body.apiKey,
      apiSecret: req.body.apiSecret
   }

   const deposits = await spotService.fetchFiatDeposits(apiCredentials)

   res.status(200).json({ deposits })
}
