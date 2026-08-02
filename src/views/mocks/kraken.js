import Big from 'big.js'

const tradingPairs = {
   XBTUSD: { id: 'XBTUSD', name: 'XBT/USD', base: { name: 'XXBT', decimals: 8 }, quote: { name: 'ZUSD', decimals: 2 } },
   ETHUSD: { id: 'ETHUSD', name: 'ETH/USD', base: { name: 'XETH', decimals: 8 }, quote: { name: 'ZUSD', decimals: 2 } },
   XBTEUR: { id: 'XBTEUR', name: 'XBT/EUR', base: { name: 'XXBT', decimals: 8 }, quote: { name: 'ZEUR', decimals: 2 } },
   ETHEUR: { id: 'ETHEUR', name: 'ETH/EUR', base: { name: 'XETH', decimals: 8 }, quote: { name: 'ZEUR', decimals: 2 } },
   ADAUSD: { id: 'ADAUSD', name: 'ADA/USD', base: { name: 'ADA', decimals: 8 }, quote: { name: 'ZUSD', decimals: 6 } },
   DOTUSD: { id: 'DOTUSD', name: 'DOT/USD', base: { name: 'DOT', decimals: 8 }, quote: { name: 'ZUSD', decimals: 4 } },
   SOLUSD: { id: 'SOLUSD', name: 'SOL/USD', base: { name: 'SOL', decimals: 8 }, quote: { name: 'ZUSD', decimals: 4 } },
   LTCUSD: { id: 'LTCUSD', name: 'LTC/USD', base: { name: 'XLTC', decimals: 8 }, quote: { name: 'ZUSD', decimals: 2 } },
   LINKUSD: { id: 'LINKUSD', name: 'LINK/USD', base: { name: 'LINK', decimals: 8 }, quote: { name: 'ZUSD', decimals: 4 } },
   MATICUSD: { id: 'MATICUSD', name: 'MATIC/USD', base: { name: 'MATIC', decimals: 8 }, quote: { name: 'ZUSD', decimals: 6 } },
}

const randomSegment = (length) =>
   Array.from({ length }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[Math.floor(Math.random() * 32)]).join('')

const fakeTxid = () => `O${randomSegment(5)}-${randomSegment(5)}-${randomSegment(6)}`

function orderBatch(params) {
   const { direction, pair, dryRun, orders = [] } = params?.ordersParams ?? {}
   return orders.map(order => {
      const descr = `${direction} ${Big(order.volume).toFixed(5)} ${pair} @ limit ${Big(order.price).toFixed(2)}`
      const result = { descr: { order: descr } }
      if (!dryRun) {
         result.txid = fakeTxid()
      }
      return result
   })
}

const balances = {
   XXBT: '1.2534000000',
   XETH: '15.8721000000',
   DOT: '245.0000000000',
   ADA: '5200.0000000000',
   SOL: '42.5600000000',
}

// Roughly the market as of the fixture's writing. SOL has no mocked rate on purpose,
// so the "no USD pair" path stays visible in mocked mode.
const assetRates = (params) => {
   const known = { BTC: 62500, ETH: 3050, DOT: 6.4, ADA: 0.46, USD: 1 }
   return {
      rates: (params?.assets ?? [])
         .filter(asset => known[asset] !== undefined)
         .reduce((rates, asset) => ({ ...rates, [asset]: known[asset] }), { USD: 1 })
   }
}

const xstocks = {
   output: [
      { name: 'XTSLA', type: 'stock', description: 'Tesla, Inc. is an American multinational automotive and clean energy company. It designs, manufactures, and sells electric vehicles, battery energy storage, and solar panels.' },
      { name: 'XAMZN', type: 'stock', description: 'Amazon.com, Inc. is an American multinational technology company focusing on e-commerce, cloud computing, online advertising, digital streaming, and artificial intelligence.' },
      { name: 'XMSFT', type: 'stock', description: 'Microsoft Corporation is an American multinational technology corporation that develops, manufactures, licenses, supports, and sells computer software and consumer electronics.' },
      { name: 'XSPY', type: 'etf', description: 'SPDR S&P 500 ETF Trust is an exchange-traded fund that tracks the S&P 500 index. It provides diversified exposure to 500 of the largest U.S. companies across all sectors, weighted by market capitalization.' },
      { name: 'XGLD', type: 'etf', description: 'SPDR Gold Shares is an exchange-traded fund that holds physical gold bullion. It offers investors a cost-effective and convenient way to invest in the gold market without directly purchasing gold bars.' },
      { name: 'XQQQM', type: 'etf', description: 'Invesco NASDAQ 100 ETF tracks the Nasdaq-100 Index, providing exposure to 100 of the largest non-financial companies listed on the Nasdaq stock exchange, with a focus on technology and growth companies.' },
   ],
   usage: { input_tokens: 1250, output_tokens: 820 },
}

export { tradingPairs, orderBatch, balances, assetRates, xstocks }
