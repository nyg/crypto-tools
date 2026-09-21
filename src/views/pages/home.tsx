import { Fragment } from 'react'
import { Link } from 'react-router'
import { KeyRoundIcon } from 'lucide-react'
import Layout from '../components/layout'
import SettingsLink from '../components/lib/settings-link'
import useSettings from '../lib/use-settings'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toolGroups } from '@/lib/tools'

const settingsGroups = toolGroups.filter(({ settings }) => settings).map(({ name }) => name)

export default function Home() {

   const { settings, isLoading } = useSettings()
   const hasApiKeys = Boolean(settings?.kraken.keyConfigured || settings?.binance.keyConfigured
      || settings?.binanceTestnet.keyConfigured || settings?.bybit.keyConfigured || settings?.bybitDemo.keyConfigured)

   return (
      <Layout name="Home">
         <div className="space-y-10">

            <section className="space-y-1.5">
               <h2 className="font-heading text-2xl font-semibold tracking-tight">Welcome</h2>
               <p className="text-sm text-muted-foreground">
                  A small collection of tools for managing Kraken and Binance accounts — batch order
                  creation, closed-order reports, balances and staking overviews — and a few that
                  need no account at all.
               </p>
            </section>

            {!isLoading && !hasApiKeys &&
               <Alert>
                  <KeyRoundIcon />
                  <AlertDescription>
                     No API keys configured yet. Add them on the Settings tab of{' '}
                     {settingsGroups.map((name, index) =>
                        <Fragment key={name}>
                           {index > 0 && (index === settingsGroups.length - 1 ? ' or ' : ', ')}
                           <SettingsLink group={name}>{name}</SettingsLink>
                        </Fragment>)}{' '}
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
