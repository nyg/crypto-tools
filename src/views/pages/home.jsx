import { useState } from 'react'
import { Link } from 'react-router'
import { CoinsIcon, GiftIcon, HistoryIcon, KeyRoundIcon, LayersIcon, ReceiptIcon, ScrollTextIcon, SparklesIcon, WalletIcon } from 'lucide-react'
import Layout from '../components/layout'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'


const toolGroups = [
   {
      name: 'Kraken',
      tools: [
         {
            href: '/kraken/order-batch',
            title: 'Order Batch',
            description: 'Create a ladder of limit orders for a trading pair in one go.',
            icon: LayersIcon
         },
         {
            href: '/kraken/closed-orders',
            title: 'Closed Orders',
            description: 'Browse the orders that filled, rebuilt from your stored trade history.',
            icon: HistoryIcon
         },
         {
            href: '/kraken/ledger',
            title: 'Ledger',
            description: 'Sync your full ledger and trade history to a local database and browse it.',
            icon: ScrollTextIcon
         },
         {
            href: '/kraken/fees',
            title: 'Fees',
            description: 'Everything Kraken has charged you, totalled per asset and over time.',
            icon: ReceiptIcon
         },
         {
            href: '/kraken/rewards',
            title: 'Rewards',
            description: 'Staking and earn rewards, per asset and per year, valued in USD.',
            icon: GiftIcon
         },
         {
            href: '/kraken/balances',
            title: 'Balances',
            description: 'Fetch your spot and staking balances.',
            icon: WalletIcon
         },
         {
            href: '/kraken/xstocks',
            title: 'xStocks',
            description: 'Browse tokenized stocks and ETFs, with AI-written summaries.',
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

export default function Home() {

   const [hasApiKeys] = useState(() => Boolean(
      typeof window !== 'undefined'
         && (localStorage.getItem('kraken.api.key') || localStorage.getItem('binance.api.key'))))

   return (
      <Layout name="Home">
         <div className="space-y-10">

            <section className="space-y-1.5">
               <h2 className="font-heading text-2xl font-semibold tracking-tight">Welcome</h2>
               <p className="max-w-prose text-sm text-muted-foreground">
                  A small collection of tools for managing Kraken and Binance accounts — batch order
                  creation, closed-order reports, balances and staking overviews.
               </p>
            </section>

            {!hasApiKeys &&
               <Alert>
                  <KeyRoundIcon />
                  <AlertDescription>
                     No API keys configured yet. Add them in{' '}
                     <Link to="/settings" className="font-medium text-foreground underline underline-offset-4">
                        Settings
                     </Link>{' '}
                     to fetch balances and create orders.
                  </AlertDescription>
               </Alert>}

            {toolGroups.map(group =>
               <section key={group.name} className="space-y-3">
                  <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                     {group.name}
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                     {group.tools.map(tool =>
                        <Link key={tool.href} to={tool.href} className="group rounded-xl focus-visible:outline-none">
                           <Card size="sm" className="h-full transition-colors group-hover:bg-muted/50 group-focus-visible:ring-2 group-focus-visible:ring-ring">
                              <CardHeader>
                                 <CardTitle className="flex items-center gap-2">
                                    <tool.icon className="size-4 text-muted-foreground" />
                                    {tool.title}
                                 </CardTitle>
                                 <CardDescription>{tool.description}</CardDescription>
                              </CardHeader>
                           </Card>
                        </Link>
                     )}
                  </div>
               </section>
            )}

         </div>
      </Layout>
   )
}
