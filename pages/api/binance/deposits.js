import BinanceAPI from '../../../lib/adapters/binance-api/adapter'


const computeToDate = fromDate => fromDate + 90 * 24 * 3600 * 1000
const delay = ms => new Promise(r => setTimeout(r, ms))

export default async function deposits({ body: { credentials, fromDate } }, res) {

   if (!credentials) {
      res.status(401).json({ error: 'No API credentials provided.' })
      return
   }

   const binanceAPI = new BinanceAPI(credentials)

   let hasNext = true
   let toDate = computeToDate(fromDate)
   const allDeposits = []

   while (hasNext) {
      const deposits = await binanceAPI.fetchFiatDeposits(fromDate, toDate)
      allDeposits.push(...deposits)

      hasNext = toDate < Date.now()
      fromDate = toDate + 1
      toDate = computeToDate(fromDate)

      await delay(35000)
   }

   res.status(200).json({ deposits: allDeposits })
}
