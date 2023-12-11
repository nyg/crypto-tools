import { spotService } from '../../core/spot-service'


export default async function getDeposits({ body: { apiKey, apiSecret } }, res) {

   if (!apiKey || !apiSecret) {
      res.status(401).json({error: 'No API credentials provided.'})
      return
   }

   const deposits = await spotService.fetchFiatDeposits({ apiKey, apiSecret})
   res.status(200).json({ deposits })
}
