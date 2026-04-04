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

function orderBatch(params) {
   const orders = params?.ordersParams?.orders ?? []
   return orders.map((order, i) => ({
      descr: {
         order: `${params.ordersParams.direction} ${order.volume} XBTUSD @ limit ${order.price}`
      }
   }))
}

const balances = {
   XXBT: '1.2534000000',
   XETH: '15.8721000000',
   DOT: '245.0000000000',
   ADA: '5200.0000000000',
   SOL: '42.5600000000',
}

const closedOrders = {
   XBTUSD: {
      pair: { id: 'XBTUSD', name: 'XBT/USD', base: { name: 'XXBT', decimals: 8 }, quote: { name: 'ZUSD', decimals: 2 } },
      buy: {
         orders: [
            { openedDate: 1704067200, volume: 0.025, cost: 1082.50, flags: 'fciq', fee: 0.28, price: 43300.00, orderId: 'OABC12-DEF34-GHI567' },
            { openedDate: 1704153600, volume: 0.015, cost: 654.75, flags: 'fciq', fee: 0.17, price: 43650.00, orderId: 'OJKL89-MNO01-PQR234' },
            { openedDate: 1704326400, volume: 0.030, cost: 1323.00, flags: 'fciq', fee: 0.34, price: 44100.00, orderId: 'OSTU56-VWX78-YZA901' },
         ],
         summary: { volume: 0.07, cost: 3060.25, price: 43717.86 },
      },
      sell: {
         orders: [
            { openedDate: 1706745600, volume: 0.020, cost: 892.00, flags: 'fciq', fee: 0.23, price: 44600.00, orderId: 'OBCD23-EFG45-HIJ678' },
            { openedDate: 1707004800, volume: 0.010, cost: 451.50, flags: 'fciq', fee: 0.12, price: 45150.00, orderId: 'OKLM90-NOP12-QRS345' },
         ],
         summary: { volume: 0.03, cost: 1343.50, price: 44783.33 },
      },
   },
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

export { tradingPairs, orderBatch, balances, closedOrders, xstocks }
