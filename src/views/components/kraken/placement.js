// Where a holding actually sits, worked out from the wallet Kraken wrote each ledger
// entry to. This is the whole point of reading balances from the ledger rather than
// from BalanceEx: the API keys earn positions under suffixes whose letters it renames
// (a position keyed XBT.F in mid-2025 is XBT.M now) and whose names belong to its API
// documentation rather than to its Earn screen — .M is "opt-in rewards" but is the
// flexible position, .B is "new yield-bearing products" but is the locked one. The
// export writes the wallet in the words the site itself uses.
//
// The one case the wallet alone does not settle is Opt-In Rewards. Kraken used to move
// opted-in coins into the earn wallet and write an "autoallocation" transfer pair for
// it; since late 2025 it leaves them in the spot wallet and simply pays the rewards
// there, with no suffix and no transfer to show for it. So a spot position that is
// still being paid is earning, and a spot position that is not is idle.

// How recently a spot position must have been paid to count as opted in. Rewards land
// daily to weekly depending on the asset, so this is generous enough to survive a
// missed payout and short enough that an asset opted out months ago drops off.
const OPT_IN_WINDOW_DAYS = 45

export const SPOT = 'spot'
export const OPT_IN = 'opt-in-rewards'
export const OTHER = 'other'

// The running order every legend, chart and badge sorts by: idle first, then the
// rewards products roughly by how hard the coins are to get back out.
export const PLACEMENT_ORDER = [SPOT, OPT_IN, 'earn-flexible', 'earn-liquid', 'earn-bonded', 'earn-locked', OTHER]

const placements = {
   [SPOT]: {
      label: 'Spot',
      description: 'Sitting in your spot wallet, not earning rewards.',
      earning: false
   },
   [OPT_IN]: {
      label: 'Opt-In Rewards',
      description: 'Staying in your spot wallet and still being paid — Kraken pays opted-in assets where they lie, so the balance stays available to trade.',
      earning: true
   },
   'earn-flexible': {
      label: 'Earn · Flexible',
      description: 'Allocated to a flexible Earn strategy, which can be unstaked at any time.',
      earning: true
   },
   'earn-liquid': {
      label: 'Earn · Liquid',
      description: 'Allocated to a liquid Earn strategy, held as a wrapped token.',
      earning: true
   },
   'earn-bonded': {
      label: 'Earn · Bonded',
      description: 'Allocated to a bonded Earn strategy, with a bonding and unbonding period before the coins are available again.',
      earning: true
   },
   'earn-locked': {
      label: 'Earn · Locked',
      description: 'Allocated to a locked Earn strategy for a fixed term.',
      earning: true
   },
   [OTHER]: {
      label: 'Other',
      description: 'A wallet this page does not have a name for yet.',
      earning: false
   }
}

const wallets = {
   'spot / main': SPOT,
   'earn / flexible': 'earn-flexible',
   'earn / liquid': 'earn-liquid',
   'earn / bonded': 'earn-bonded',
   'earn / locked': 'earn-locked'
}

export function placementOf(position, now = Date.now()) {

   const key = wallets[position?.wallet] ?? OTHER

   if (key !== SPOT) return key

   const paidWithinWindow = position?.lastRewardAt != null
      && now - position.lastRewardAt <= OPT_IN_WINDOW_DAYS * 86400000

   return paidWithinWindow ? OPT_IN : SPOT
}

// Unknown wallets keep their raw name rather than all collapsing into one "Other"
// badge: if Kraken adds a sixth wallet, it should be visible that it did.
export function placementLabel(key, position) {
   return key === OTHER ? (position?.wallet || 'Unknown') : placements[key].label
}

export const placementDescription = key => placements[key].description
export const isEarning = key => placements[key].earning

// One colour per placement, fixed by position in PLACEMENT_ORDER so the ring, the
// legend and the badges agree however few of them a given account uses. Idle spot is
// the grey one on purpose: it is the slice that is doing nothing.
export const placementColor = key =>
   key === SPOT
      ? 'var(--muted-foreground)'
      : `var(--chart-${(PLACEMENT_ORDER.indexOf(key) % 8) + 1})`
