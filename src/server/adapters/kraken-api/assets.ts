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

// Assets Kraken has since renamed or migrated.
const assetAliases: Record<string, string> = {
   'XBT': 'BTC',
   'XDG': 'DOGE',
   'ETH2': 'ETH',
   'MATIC': 'POL'
}

export function normalizeAsset(asset: string | undefined): string {
   if (!asset) return ''

   // Strip any staking, earn or parachain suffix: DOT28.S becomes DOT, XBT.F becomes
   // XBT. Only a trailing suffix is removed, digits and all — splitting on the first
   // digit anywhere would turn AI16Z into AI and USD1 into USD, which are different
   // assets entirely. Tickers that carry no suffix (0G, 1INCH, AI16Z) come back whole.
   let base = asset.replace(/\d*\.[A-Z]+$/, '') || asset

   if (prefixedAssets.has(asset) || prefixedAssets.has(base)) {
      base = base.slice(1)
   }

   return assetAliases[base] ?? assetAliases[asset] ?? base
}
