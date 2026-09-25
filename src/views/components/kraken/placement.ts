import type { LivePosition } from '../../../types/kraken'

export type Placement = string

interface PlacementInfo {
   label: string
   description: string
   earning: boolean
}

export const SPOT = 'spot'
export const OPT_IN = 'opt-in-rewards'
export const OTHER = 'other'

// The running order every legend, chart and badge sorts by: idle first, then the
// rewards products roughly by how hard the coins are to get back out.
export const PLACEMENT_ORDER: Placement[] = [SPOT, OPT_IN, 'earn-flexible', 'earn-bonded', 'earn-locked', OTHER]

const placements: Record<string, PlacementInfo> = {
   [SPOT]: {
      label: 'Spot',
      description: 'Sitting in your spot wallet, not allocated to any Earn strategy.',
      earning: false
   },
   [OPT_IN]: {
      label: 'Opt-In Rewards',
      description: 'Allocated to a flexible Earn strategy that pays it where it lies, so the balance stays in your spot wallet and available to trade.',
      earning: true
   },
   'earn-flexible': {
      label: 'Earn · Flexible',
      description: 'Allocated to an Earn strategy with no bonding or unbonding period, so it can be taken back out at any time.',
      earning: true
   },
   'earn-bonded': {
      label: 'Earn · Bonded',
      description: 'Allocated to a bonded Earn strategy, which has to unbond before the coins are available again.',
      earning: true
   },
   'earn-locked': {
      label: 'Earn · Locked',
      description: 'Allocated to a timed Earn strategy for a fixed term.',
      earning: true
   },
   [OTHER]: {
      label: 'Other',
      description: 'Allocated to an Earn strategy of a kind this page does not have a name for yet.',
      earning: true
   }
}

const lockTypes: Record<string, Placement> = {
   flex: OPT_IN,
   instant: 'earn-flexible',
   bonded: 'earn-bonded',
   timed: 'earn-locked'
}

export const placementOf = (position: LivePosition): Placement =>
   position.strategyId === null ? SPOT : lockTypes[position.lockType] ?? OTHER

// Unknown lock types keep their raw name rather than all collapsing into one "Other"
// badge: if Kraken adds a fifth one, it should be visible that it did.
export function placementLabel(key: Placement, position?: LivePosition): string {
   return key === OTHER ? (position?.lockType || 'Unknown') : (placements[key]?.label ?? key)
}

export const placementDescription = (key: Placement): string => placements[key]?.description ?? ''
export const isEarning = (key: Placement): boolean => placements[key]?.earning ?? false

// One colour per placement, fixed by position in PLACEMENT_ORDER so the ring, the
// legend and the badges agree however few of them a given account uses. Idle spot is
// the grey one on purpose: it is the slice that is doing nothing.
export const placementColor = (key: Placement): string =>
   key === SPOT
      ? 'var(--muted-foreground)'
      : `var(--chart-${(PLACEMENT_ORDER.indexOf(key) % 8) + 1})`
