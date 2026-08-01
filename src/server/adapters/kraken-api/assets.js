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
const assetAliases = {
   'XBT': 'BTC',
   'XDG': 'DOGE',
   'ETH2': 'ETH',
   'MATIC': 'POL'
}

export function normalizeAsset(asset) {
   if (!asset) return ''

   // Strip any staking, earn or parachain suffix: DOT28.S becomes DOT, XBT.F becomes
   // XBT. Tickers that are entirely digits-and-letters (0G, 1INCH) fall back to the
   // original, since splitting them would leave nothing.
   let base = asset.split(/[0-9.]/)[0] || asset

   if (prefixedAssets.has(asset) || prefixedAssets.has(base)) {
      base = base.slice(1)
   }

   return assetAliases[base] ?? assetAliases[asset] ?? base
}

// Which balance bucket an asset name belongs to. The order matters: DOT28.S is
// staking rather than earning because the earn pattern needs a letter immediately
// before the dot.
export function assetCategory(asset) {
   if (/[A-Z]+\.P/.test(asset)) return 'parachain'
   if (/[A-Z]+\.[SFMB]/.test(asset)) return 'earning'
   if (/[A-Z]+[0-9]+\.S/.test(asset)) return 'staking'
   return 'free'
}

// Allocation movements share the staking and earn ledger types but are transfers
// rather than income, so they are not rewards.
const nonRewardSubTypes = ['allocation', 'deallocation', 'autoallocation', 'migration']

export function isStakingReward({ type, subtype }) {
   return ['staking', 'earn'].includes(type?.toLowerCase())
      && !nonRewardSubTypes.includes(subtype?.toLowerCase())
}
