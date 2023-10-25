import Big from 'big.js'

import { marketService } from '../../core/market-service'


export default async function getEOYRates(req, res) {

   const assets = ['1INCH', 'AAVE', 'ADA', 'ALGO', 'ATOM', 'AXS', 'BAND', 'BAT', 'BCH', 'BTTC', 'BNB', 'BTC', 'CHSB', 'COMP', 'CRO', 'CRV', 'DOT', 'DYDX', 'EFI', 'ENJ', 'EOS', 'ETH', 'ETHW', 'FIL', 'GO', 'GRT', 'HEGIC', 'KNC', 'LTC', 'LUNA', 'LUNC', 'MATIC', 'NMC', 'OGN', 'OGV', 'REEF', 'REN', 'SAND', 'SGB', 'SHIB', 'SNX', 'SOL', 'UMA', 'UNI', 'UTK', 'XLM', 'XMR', 'XRP', 'XTZ', 'ZEC', 'ZRX']
   const rates = await marketService.fetchEOYRates(assets, 'USDT')
   const text = Object.keys(rates).map(asset => `${asset}\t${rates[asset]}`).join('\n')

   res.status(200).send(text)
}
