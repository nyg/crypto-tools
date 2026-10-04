// Kraken names the same asset several ways: the JSON API returns XXBT and ZUSD,
// the ledger export writes BTC and USD, and staking or earn positions carry a
// suffix (DOT28.S, XBT.F). Everything is normalized to the display name so that
// the Ledger and Balances pages agree.

// Listed explicitly: a blind /^[XZ][A-Z]{3}$/ would mangle any genuine four-letter
// ticker starting with X or Z (ZEUS would become EUS).
const prefixedAssets = new Set([
   'XXBT', 'XETH', 'XLTC', 'XXRP', 'XXLM', 'XXDG', 'XETC', 'XMLN',
   'XREP', 'XXMR', 'XZEC', 'XXTZ', 'XICN', 'XNMC', 'XVEN',
   'ZUSD', 'ZEUR', 'ZGBP', 'ZCAD', 'ZJPY', 'ZAUD', 'ZCHF'
])

// Listed explicitly as well: before a suffix, a lock period (DOT28.S) and the last digit
// of a ticker (LUNA2.F) look the same, and LUNA is a different asset from LUNA2. These
// are the tickers in Kraken's public Assets that end in a digit, whether or not one
// carries a suffix today. A ticker added here also needs its stored rows rewritten:
// append keepTickerDigits to the migrations in src/server/db/database.ts again.
export const digitTickers = new Set([
   'AI3', 'API3', 'AUSDT0', 'B2', 'B3', 'BANANAS31', 'BRL1', 'C98', 'ETH2', 'GAME2',
   'L3', 'LUNA2', 'REPV2', 'SN8', 'SN44', 'SN51', 'SN62', 'SN64', 'SN75',
   'USD1', 'USDT0', 'XL1', 'XU3O8'
])

// Other names Kraken gives an asset, whatever the date.
const assetAliases: Record<string, string> = {
   'XBT': 'BTC',
   'XDG': 'DOGE',
   'ETH2': 'ETH'
}

// Assets Kraken renamed on a date: what it wrote before still carries the old ticker.
// The pages list one under both names, from formerTickers in
// src/views/components/kraken/asset-migrations.ts — change the two together.
export const renamedAssets: Record<string, string> = {
   'MATIC': 'POL'
}

// The ticker as it was when Kraken wrote it: MATIC stays MATIC.
export function tickerOf(asset: string | undefined): string {
   if (!asset) return ''

   // Strip any staking, earn or parachain suffix: DOT28.S becomes DOT, XBT.F becomes
   // XBT. Only a trailing suffix is removed, and the digits before it unless a ticker
   // ends in them (LUNA2.F is LUNA2) — splitting on the first digit anywhere would turn
   // AI16Z into AI and USD1 into USD, which are different assets entirely. Tickers that
   // carry no suffix (0G, 1INCH, AI16Z) come back whole.
   let base = asset.replace(/\.[A-Z]+$/, '')

   if (base !== asset && !digitTickers.has(base)) {
      base = base.replace(/\d+$/, '') || asset
   }

   if (prefixedAssets.has(asset) || prefixedAssets.has(base)) {
      base = base.slice(1)
   }

   return assetAliases[base] ?? assetAliases[asset] ?? base
}

// The asset an amount is added up under: MATIC and POL are one holding.
export function normalizeAsset(asset: string | undefined): string {
   const ticker = tickerOf(asset)
   return renamedAssets[ticker] ?? ticker
}
