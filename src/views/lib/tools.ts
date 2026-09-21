import type { LucideIcon } from 'lucide-react'
import { CalculatorIcon, CoinsIcon, GiftIcon, LayersIcon, ListChecksIcon, PieChartIcon, ReceiptIcon, ScrollTextIcon, SigmaIcon, SparklesIcon, WalletIcon } from 'lucide-react'
import type { Provider } from '../../types/credentials'


// The single source of truth for navigation: the home dashboard, the per-exchange
// sub-navs and the header links all read this list, so their order can't drift apart.
// Tools are ordered data-first — the ledger is what the other pages read from, then
// the views derived from it, then the one page that writes to the exchange.
//
// readsLedger marks the pages served by the local database rather than by a live call,
// which is what decides whether the age of that database is worth showing beside the
// tabs: on a page that talks to Kraken every time, it would say nothing about what is
// on screen.
export interface Tool {
   href: string
   title: string
   description: string
   icon: LucideIcon
   // Marks the pages served by the local database rather than by a live call.
   readsLedger?: boolean
}

export interface ToolGroup {
   name: string
   tools: Tool[]
   settings?: GroupSettings
}

export interface GroupSettings {
   href: string
   providers: [Provider, ...Provider[]]
}

const portfolios = (exchange: string): Tool => ({
   href: `/${exchange}/portfolios`,
   title: 'Portfolios',
   description: 'Keep baskets of coins at their target weights: deposit, withdraw and rebalance with market orders.',
   icon: PieChartIcon
})

export const toolGroups: ToolGroup[] = [
   {
      name: 'Kraken',
      tools: [
         {
            href: '/kraken/ledger',
            readsLedger: true,
            title: 'Ledger',
            description: 'Sync your full ledger and trade history to a local database and browse it.',
            icon: ScrollTextIcon
         },
         {
            href: '/kraken/balances',
            readsLedger: true,
            title: 'Balances',
            description: 'Fetch your spot and staking balances.',
            icon: WalletIcon
         },
         {
            href: '/kraken/rewards',
            readsLedger: true,
            title: 'Rewards',
            description: 'Staking and earn rewards, per asset and per year, valued in USD.',
            icon: GiftIcon
         },
         {
            href: '/kraken/fees',
            readsLedger: true,
            title: 'Fees',
            description: 'Everything Kraken has charged you, totalled per asset and over time.',
            icon: ReceiptIcon
         },
         {
            href: '/kraken/aggregated-trades',
            readsLedger: true,
            title: 'Aggregated Trades',
            description: 'Fold your trades into runs of buying and selling for one asset, across every quote currency.',
            icon: SigmaIcon
         },
         {
            href: '/kraken/open-orders',
            title: 'Open Orders',
            description: 'See what is still on the book, grouped by pair, and cancel one order or a whole series.',
            icon: ListChecksIcon
         },
         {
            href: '/kraken/order-batch',
            title: 'Order Batch',
            description: 'Create a series of limit orders for a trading pair in one go.',
            icon: LayersIcon
         },
         portfolios('kraken'),
         {
            href: '/kraken/xstocks',
            title: 'xStocks',
            description: 'See which tokenized listings are stocks and which are ETFs, with optional AI-written descriptions.',
            icon: SparklesIcon
         }
      ],
      settings: { href: '/kraken/settings', providers: ['kraken', 'anthropic'] }
   },
   {
      name: 'Binance',
      tools: [
         {
            href: '/binance/staking',
            title: 'Staking',
            description: 'Overview of your staking positions and upcoming redemptions.',
            icon: CoinsIcon
         },
         portfolios('binance')
      ],
      settings: { href: '/binance/settings', providers: ['binance', 'binanceTestnet'] }
   },
   {
      name: 'Bybit',
      tools: [portfolios('bybit')],
      settings: { href: '/bybit/settings', providers: ['bybit', 'bybitDemo'] }
   },
   {
      name: 'Tools',
      tools: [
         {
            href: '/tools/trade-calculator',
            title: 'Trade Calculator',
            description: 'Size a position from the risk you are willing to take, and lay out its take profit levels.',
            icon: CalculatorIcon
         }
      ]
   }
]

const groupBy = (name: string): ToolGroup => {
   const group = toolGroups.find(group => group.name === name)
   if (!group) throw new Error(`No tool group named ${name}.`)
   return group
}

const tabsOf = ({ tools, settings }: ToolGroup) => [
   ...tools.map(({ title, href }) => ({ label: title, href })),
   ...settings ? [{ label: 'Settings', href: settings.href }] : []
]

export const groupOfPath = (path: string): ToolGroup | undefined =>
   toolGroups.find(group => tabsOf(group).some(({ href }) => href === path))

export const tabHrefs = (name: string) => tabsOf(groupBy(name)).map(({ href }) => href)

export const settingsOf = (name: string): GroupSettings => {
   const { settings } = groupBy(name)
   if (!settings) throw new Error(`The ${name} tool group has no settings.`)
   return settings
}

// Where the header menu sends you for an exchange none of whose tabs was opened yet: its first tool.
export const groupHref = (name: string): string => {
   const [first] = groupBy(name).tools
   if (!first) throw new Error(`The ${name} tool group has no tools.`)
   return first.href
}

export const subNavItems = (name: string) => tabsOf(groupBy(name))

// The routes whose data comes out of the synced ledger, for the sub-nav to check.
export const ledgerBackedPaths = new Set(
   toolGroups.flatMap(group => group.tools)
      .filter(tool => tool.readsLedger)
      .map(tool => tool.href))

// Every route that gets a sub-nav, so that whatever the sub-nav already shows is not
// shown a second time by the header above it.
export const tabPaths = new Set(toolGroups.flatMap(tabsOf).map(({ href }) => href))
