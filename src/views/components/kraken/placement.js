// Where a holding actually sits, worked out from the wallet Kraken wrote each ledger
// entry to. This is the whole point of reading balances from the ledger rather than
// from BalanceEx: the API returns one number per asset, while the export says which
// of the five wallets every movement went through.
//
// The one case the wallet alone does not settle is Auto Earn. Kraken used to move
// opted-in coins into the earn wallet and write an "autoallocation" transfer pair for
// it; since late 2025 it leaves them in spot and simply pays the rewards there. So a
// spot position that is still being paid is an earning position, and a spot position
// that is not is idle — a distinction the Kraken web interface does not draw at all.

// How recently a spot position must have been paid to count as Auto Earn. Rewards land
// daily to weekly depending on the asset, so this is generous enough to survive a
// missed payout and short enough that an asset opted out months ago drops off.
const AUTO_EARN_WINDOW_DAYS = 45

export const SPOT = 'spot'
export const AUTO_EARN = 'auto-earn'
export const OTHER = 'other'

// The running order every legend, chart and badge sorts by: idle first, then the earn
// products roughly by how hard the coins are to get back out.
export const PLACEMENT_ORDER = [SPOT, AUTO_EARN, 'earn-flexible', 'earn-liquid', 'earn-bonded', 'earn-locked', OTHER]

const placements = {
   [SPOT]: {
      label: 'Spot',
      description: 'Sitting in the spot wallet, earning nothing.',
      earning: false
   },
   [AUTO_EARN]: {
      label: 'Auto Earn',
      description: 'Left in the spot wallet, but still being paid rewards — Kraken pays opted-in assets where they lie.',
      earning: true
   },
   'earn-flexible': {
      label: 'Earn · Flexible',
      description: 'Allocated to a flexible Earn position, which can be unstaked at any time.',
      earning: true
   },
   'earn-liquid': {
      label: 'Earn · Liquid',
      description: 'Allocated to a liquid staking position, held as a wrapped token.',
      earning: true
   },
   'earn-bonded': {
      label: 'Earn · Bonded',
      description: 'Allocated to a bonded Earn position, with a bonding and unbonding period.',
      earning: true
   },
   'earn-locked': {
      label: 'Earn · Locked',
      description: 'Allocated to a locked Earn position for a fixed term.',
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
      && now - position.lastRewardAt <= AUTO_EARN_WINDOW_DAYS * 86400000

   return paidWithinWindow ? AUTO_EARN : SPOT
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
