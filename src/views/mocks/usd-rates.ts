const DAY = 86400000
const YEAR = 365 * DAY

// Roughly the market as of the fixture's writing. CHF has no mocked rate on purpose,
// so the "no USD pair" path stays visible in mocked mode.
export const mockUsdPrices: Record<string, number> = {
   BTC: 62500, ETH: 3050, DOT: 6.4, ADA: 0.46, LINK: 12.5, SOL: 148,
   USD: 1, EUR: 1.08, USDT: 1, USDC: 1
}

const pegged = new Set(['USD', 'USDT', 'USDC'])

const fiat = new Set(['EUR'])

const unpricedBefore: Record<string, number> = {
   DOT: Date.UTC(2024, 6, 1)
}

export function mockUsdRateOn(asset: string, time: number, now = Date.now()): number | null {

   const today = mockUsdPrices[asset]
   if (today === undefined || time < (unpricedBefore[asset] ?? -Infinity)) return null
   if (pegged.has(asset)) return today

   const day = time - (time % DAY)
   const wave = Math.sin(day / (41 * DAY) + asset.length)

   if (fiat.has(asset)) return today * (1 + 0.03 * wave)

   return today * Math.pow(0.7, Math.max(0, now - day) / YEAR) * (1 + 0.15 * wave)
}
