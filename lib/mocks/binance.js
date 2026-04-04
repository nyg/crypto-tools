const aggregateBalance = {
   balance: [
      {
         asset: 'BNB',
         free: 12.45,
         locked: 0,
         staking: {
            balance: 50,
            positions: [
               { id: 'pos-bnb-1', asset: 'BNB', amount: 25, apy: 0.0625, accrualDays: 45, deliverDate: Date.now() + 15 * 86400000, endDate: Date.now() + 15 * 86400000, duration: 60 },
               { id: 'pos-bnb-2', asset: 'BNB', amount: 25, apy: 0.0580, accrualDays: 78, deliverDate: Date.now() + 12 * 86400000, endDate: Date.now() + 12 * 86400000, duration: 90 },
            ],
            products: [
               {
                  info: { productId: 'BNB-60', asset: 'BNB', duration: 60, apy: 0.0625, soldOut: false, maxStakingAmount: 200, positionsAmount: 50, minStakingAmount: 1 },
                  positions: [
                     { id: 'pos-bnb-1', amount: 25, apy: 0.0625, accrualDays: 45, deliverDate: Date.now() + 15 * 86400000, duration: 60 },
                  ],
               },
               {
                  info: { productId: 'BNB-90', asset: 'BNB', duration: 90, apy: 0.0720, soldOut: true, maxStakingAmount: 200, positionsAmount: 25, minStakingAmount: 1 },
                  positions: [
                     { id: 'pos-bnb-2', amount: 25, apy: 0.0580, accrualDays: 78, deliverDate: Date.now() + 12 * 86400000, duration: 90 },
                  ],
               },
            ],
         },
         total: 62.45,
         freeFiatValue: 7494,
         fiatValue: 37530,
      },
      {
         asset: 'ETH',
         free: 3.215,
         locked: 0,
         staking: {
            balance: 5,
            positions: [
               { id: 'pos-eth-1', asset: 'ETH', amount: 5, apy: 0.0340, accrualDays: 52, deliverDate: Date.now() + 38 * 86400000, endDate: Date.now() + 38 * 86400000, duration: 90 },
            ],
            products: [
               {
                  info: { productId: 'ETH-90', asset: 'ETH', duration: 90, apy: 0.0340, soldOut: false, maxStakingAmount: 100, positionsAmount: 5, minStakingAmount: 0.1 },
                  positions: [
                     { id: 'pos-eth-1', amount: 5, apy: 0.0340, accrualDays: 52, deliverDate: Date.now() + 38 * 86400000, duration: 90 },
                  ],
               },
            ],
         },
         total: 8.215,
         freeFiatValue: 10284.80,
         fiatValue: 26287.60,
      },
      {
         asset: 'DOT',
         free: 120,
         locked: 0,
         staking: {
            balance: 500,
            positions: [
               { id: 'pos-dot-1', asset: 'DOT', amount: 300, apy: 0.1250, accrualDays: 20, deliverDate: Date.now() + 40 * 86400000, endDate: Date.now() + 40 * 86400000, duration: 60 },
               { id: 'pos-dot-2', asset: 'DOT', amount: 200, apy: 0.1400, accrualDays: 5, deliverDate: Date.now() + 115 * 86400000, endDate: Date.now() + 115 * 86400000, duration: 120 },
            ],
            products: [
               {
                  info: { productId: 'DOT-60', asset: 'DOT', duration: 60, apy: 0.1250, soldOut: false, maxStakingAmount: 10000, positionsAmount: 300, minStakingAmount: 10 },
                  positions: [
                     { id: 'pos-dot-1', amount: 300, apy: 0.1250, accrualDays: 20, deliverDate: Date.now() + 40 * 86400000, duration: 60 },
                  ],
               },
               {
                  info: { productId: 'DOT-120', asset: 'DOT', duration: 120, apy: 0.1400, soldOut: false, maxStakingAmount: 10000, positionsAmount: 200, minStakingAmount: 10 },
                  positions: [
                     { id: 'pos-dot-2', amount: 200, apy: 0.1400, accrualDays: 5, deliverDate: Date.now() + 115 * 86400000, duration: 120 },
                  ],
               },
            ],
         },
         total: 620,
         freeFiatValue: 840,
         fiatValue: 4340,
      },
      {
         asset: 'AVAX',
         free: 85.5,
         locked: 0,
         staking: {
            balance: 0,
            positions: [],
            products: [
               {
                  info: { productId: 'AVAX-30', asset: 'AVAX', duration: 30, apy: 0.0450, soldOut: true, maxStakingAmount: 5000, positionsAmount: 0, minStakingAmount: 5 },
                  positions: [],
               },
            ],
         },
         total: 85.5,
         freeFiatValue: 2992.50,
         fiatValue: 2992.50,
      },
   ],
}

export { aggregateBalance }
