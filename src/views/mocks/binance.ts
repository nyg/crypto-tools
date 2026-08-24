import type { AggregateBalanceResponse } from '../../types/api'

const aggregateBalance: AggregateBalanceResponse = {
   balance: [
      {
         asset: 'BNB',
         free: '12.45',
         locked: '0',
         staking: {
            balance: '50',
            positions: [
               { id: 'pos-bnb-1', asset: 'BNB', amount: '25', apy: '0.0625', accrualDays: 45, endDate: Date.now() + 15 * 86400000, duration: 60 },
               { id: 'pos-bnb-2', asset: 'BNB', amount: '25', apy: '0.0580', accrualDays: 78, endDate: Date.now() + 12 * 86400000, duration: 90 },
            ],
            products: [
               {
                  info: { id: 'BNB-60', duration: 60, apy: '0.0625', soldOut: false, maxStakingAmount: '200', positionsAmount: '50', minStakingAmount: '1' },
                  positions: [
                     { asset: 'BNB', id: 'pos-bnb-1', amount: '25', apy: '0.0625', accrualDays: 45, endDate: Date.now() + 15 * 86400000, duration: 60 },
                  ],
               },
               {
                  info: { id: 'BNB-90', duration: 90, apy: '0.0720', soldOut: true, maxStakingAmount: '200', positionsAmount: '25', minStakingAmount: '1' },
                  positions: [
                     { asset: 'BNB', id: 'pos-bnb-2', amount: '25', apy: '0.0580', accrualDays: 78, endDate: Date.now() + 12 * 86400000, duration: 90 },
                  ],
               },
            ],
         },
         total: '62.45',
         freeFiatValue: '7494',
         fiatValue: '37530',
      },
      {
         asset: 'ETH',
         free: '3.215',
         locked: '0',
         staking: {
            balance: '5',
            positions: [
               { id: 'pos-eth-1', asset: 'ETH', amount: '5', apy: '0.0340', accrualDays: 52, endDate: Date.now() + 38 * 86400000, duration: 90 },
            ],
            products: [
               {
                  info: { id: 'ETH-90', duration: 90, apy: '0.0340', soldOut: false, maxStakingAmount: '100', positionsAmount: '5', minStakingAmount: '0.1' },
                  positions: [
                     { asset: 'ETH', id: 'pos-eth-1', amount: '5', apy: '0.0340', accrualDays: 52, endDate: Date.now() + 38 * 86400000, duration: 90 },
                  ],
               },
            ],
         },
         total: '8.215',
         freeFiatValue: '10284.80',
         fiatValue: '26287.60',
      },
      {
         asset: 'DOT',
         free: '120',
         locked: '0',
         staking: {
            balance: '500',
            positions: [
               { id: 'pos-dot-1', asset: 'DOT', amount: '300', apy: '0.1250', accrualDays: 20, endDate: Date.now() + 40 * 86400000, duration: 60 },
               { id: 'pos-dot-2', asset: 'DOT', amount: '200', apy: '0.1400', accrualDays: 5, endDate: Date.now() + 115 * 86400000, duration: 120 },
            ],
            products: [
               {
                  info: { id: 'DOT-60', duration: 60, apy: '0.1250', soldOut: false, maxStakingAmount: '10000', positionsAmount: '300', minStakingAmount: '10' },
                  positions: [
                     { asset: 'DOT', id: 'pos-dot-1', amount: '300', apy: '0.1250', accrualDays: 20, endDate: Date.now() + 40 * 86400000, duration: 60 },
                  ],
               },
               {
                  info: { id: 'DOT-120', duration: 120, apy: '0.1400', soldOut: false, maxStakingAmount: '10000', positionsAmount: '200', minStakingAmount: '10' },
                  positions: [
                     { asset: 'DOT', id: 'pos-dot-2', amount: '200', apy: '0.1400', accrualDays: 5, endDate: Date.now() + 115 * 86400000, duration: 120 },
                  ],
               },
            ],
         },
         total: '620',
         freeFiatValue: '840',
         fiatValue: '4340',
      },
      {
         asset: 'AVAX',
         free: '85.5',
         locked: '0',
         staking: {
            balance: '0',
            positions: [],
            products: [
               {
                  info: { id: 'AVAX-30', duration: 30, apy: '0.0450', soldOut: true, maxStakingAmount: '5000', positionsAmount: '0', minStakingAmount: '5' },
                  positions: [],
               },
               {
                  info: { id: 'AVAX-60', duration: 60, apy: '0.0510', soldOut: false, maxStakingAmount: '100', positionsAmount: '100', minStakingAmount: '5' },
                  positions: [],
               },
               {
                  info: { id: 'AVAX-90', duration: 90, apy: '0.0560', soldOut: false, maxStakingAmount: '100', positionsAmount: '98', minStakingAmount: '5' },
                  positions: [],
               },
               {
                  info: { id: 'AVAX-120', duration: 120, apy: '0.0605', soldOut: false, maxStakingAmount: '100', positionsAmount: '50', minStakingAmount: '5' },
                  positions: [],
               },
            ],
         },
         total: '85.5',
         freeFiatValue: '2992.50',
         fiatValue: '2992.50',
      },
   ],
}

export { aggregateBalance }
