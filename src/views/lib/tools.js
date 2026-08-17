import { CoinsIcon, GiftIcon, HistoryIcon, LayersIcon, ListChecksIcon, ReceiptIcon, ScrollTextIcon, SparklesIcon, WalletIcon } from 'lucide-react'


// The single source of truth for navigation: the home dashboard, the per-exchange
// sub-navs and the header links all read this list, so their order can't drift apart.
// Tools are ordered data-first — the ledger is what the other pages read from, then
// the views derived from it, then the one page that writes to the exchange.
export const toolGroups = [
   {
      name: 'Kraken',
      tools: [
         {
            href: '/kraken/ledger',
            title: 'Ledger',
            description: 'Sync your full ledger and trade history to a local database and browse it.',
            icon: ScrollTextIcon
         },
         {
            href: '/kraken/balances',
            title: 'Balances',
            description: 'Fetch your spot and staking balances.',
            icon: WalletIcon
         },
         {
            href: '/kraken/rewards',
            title: 'Rewards',
            description: 'Staking and earn rewards, per asset and per year, valued in USD.',
            icon: GiftIcon
         },
         {
            href: '/kraken/fees',
            title: 'Fees',
            description: 'Everything Kraken has charged you, totalled per asset and over time.',
            icon: ReceiptIcon
         },
         {
            href: '/kraken/closed-orders',
            title: 'Closed Orders',
            description: 'Browse the orders that filled, rebuilt from your stored trade history.',
            icon: HistoryIcon
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
         {
            href: '/kraken/xstocks',
            title: 'xStocks',
            description: 'See which tokenized listings are stocks and which are ETFs, with optional AI-written descriptions.',
            icon: SparklesIcon
         }
      ]
   },
   {
      name: 'Binance',
      tools: [
         {
            href: '/binance/staking',
            title: 'Staking',
            description: 'Overview of your staking positions and upcoming redemptions.',
            icon: CoinsIcon
         }
      ]
   }
]

const groupBy = name => toolGroups.find(group => group.name === name)

// Where the header menu sends you for an exchange: its first tool.
export const groupHref = name => groupBy(name).tools[0].href

export const subNavItems = name =>
   groupBy(name).tools.map(({ title, href }) => ({ label: title, href }))
