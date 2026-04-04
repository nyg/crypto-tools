function generateYieldData(timeFrame) {
   const assets = ['BTC', 'ETH', 'USDC', 'CHSB', 'USDT']
   const now = Date.now()
   const days = timeFrame === 'all' ? 365 : parseInt(timeFrame) || 90
   const msPerDay = 86400000

   const baseRates = { BTC: 2.5, ETH: 3.2, USDC: 8.5, CHSB: 12.0, USDT: 7.8 }

   const yields = []
   const xTicks = []

   for (let i = days; i >= 0; i--) {
      const date = now - i * msPerDay
      const d = new Date(date)

      if (d.getDate() === 1 || d.getDate() === 15) {
         xTicks.push(date)
      }

      const entry = { date }
      for (const asset of assets) {
         const base = baseRates[asset]
         const variation = Math.sin(i / 15) * 0.8 + Math.cos(i / 7) * 0.4
         const trend = (days - i) / days * 0.5
         entry[asset] = Math.max(0.1, base + variation - trend)
      }
      yields.push(entry)
   }

   return { yields, xTicks, assets }
}

function generateCommunityIndex() {
   const now = Date.now()
   const msPerDay = 86400000
   const communityIndices = []

   for (let i = 180; i >= 0; i -= 7) {
      const date = now - i * msPerDay
      const base = 6.5
      const variation = Math.sin(i / 20) * 1.2 + Math.cos(i / 10) * 0.5
      communityIndices.push({
         date,
         value: Math.round((base + variation) * 10) / 10,
      })
   }

   return { communityIndices }
}

function generateYieldAverages() {
   const assets = ['BTC Genesis', 'ETH Genesis', 'USDC Genesis', 'CHSB Genesis', 'USDT Genesis']
   const baseRates = { 'BTC Genesis': 2.8, 'ETH Genesis': 3.5, 'USDC Genesis': 9.0, 'CHSB Genesis': 13.0, 'USDT Genesis': 8.2 }

   const yieldAverages = []
   const now = new Date()

   for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const entry = { date: d.getTime() }
      for (const asset of assets) {
         const base = baseRates[asset]
         const variation = Math.sin(i / 3) * 0.6 + Math.cos(i / 5) * 0.3
         entry[asset] = Math.max(0.1, base + variation)
      }
      yieldAverages.push(entry)
   }

   return { yieldAverages, assets }
}

export { generateYieldData, generateCommunityIndex, generateYieldAverages }
