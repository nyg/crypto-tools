import BinanceAPI from '../../../lib/adapters/binance-api/adapter'


export default async function eoyRates(req, res) {

   const binanceAPI = new BinanceAPI()

   // const startTime = new Date('2023-12-31').getTime()
   // const endTime = new Date('2024-01-01').getTime() - 1

   const startTime = new Date('2024-01-01T23:28:00Z').getTime()
   const endTime = new Date('2024-01-01T23:29:00Z').getTime()

   const assets = ['1INCH', 'AAVE', 'ADA', 'ALGO', 'ATOM', 'AXS', 'BAND', 'BAT', 'BCH', 'BTTC', 'BNB', 'BONK', 'BTC', 'CFG', 'CHSB', 'COMP', 'CRO', 'CRV', 'DOGE', 'DOT', 'DYDX', 'ENJ', 'EOS', 'ETH', 'ETHW', 'FIL', 'FLR', 'GO', 'GRT', 'HEGIC', 'KNC', 'LRC', 'LTC', 'LUNA', 'LUNC', 'MATIC', 'OGN', 'OGV', 'OP', 'PEPE', 'REEF', 'REN', 'SAND', 'SGB', 'SHIB', 'SNX', 'SOL', 'UMA', 'UNI', 'UTK', 'XLM', 'XMR', 'XRP', 'XTZ', 'ZEC', 'ZRX']
   const rates = {}

   for (const asset of assets) {
      try {
         const candlestick = await binanceAPI.fetchCandlestickData(`${asset}USDT`, '1m', startTime, endTime, 1)
         rates[asset] = candlestick[0].close
      }
      catch (error) {
         log.error(error)
         //rates[asset] = 'not found'
      }
   }

   res.status(200).send(Object.keys(rates).map(pair => `${pair},${rates[pair]}`).join('\n'))
}
