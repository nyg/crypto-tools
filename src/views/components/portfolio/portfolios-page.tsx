import { useEffect, useRef, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { Loader2Icon, PlusIcon, RefreshCwIcon } from 'lucide-react'
import useMutation from '../../lib/use-mutation'
import usePersistentState from '../../lib/use-persistent-state'
import { useProvider } from '../../lib/use-settings'
import CredentialsAlert from '../lib/credentials-alert'
import AccountSummary from './account-summary'
import AdjustDialog from './adjust-dialog'
import ArchiveDialog from './archive-dialog'
import DepositDialog from './deposit-dialog'
import HistoryDialog from './history-dialog'
import PlanDialog from './plan-dialog'
import PortfolioCard from './portfolio-card'
import PortfolioEditorDialog from './portfolio-editor-dialog'
import RunProgress from './run-progress'
import WithdrawDialog from './withdraw-dialog'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { asLocalTimestamp, asLongDate, asUtcTimestamp } from '../../../utils/format'
import type { PlanTarget } from './plan-dialog'
import { asQuantity, asQuoteAmount } from './format'
import type {
   AccountCoin, PortfolioArchiveRequest, PortfolioArchiveResponse, PortfolioOverviewResponse,
   PortfolioStopAckRequest, PortfolioStopAckResponse, PortfolioSummary
} from '../../../types/api'
import type { VenueId } from '../../../types/portfolio'

export interface PortfolioVenue {
   id: VenueId
   tab: string
   label: string
   apiBase: string
   live: boolean
   quoteAsset: string
   wallet: string
   setup: ReactNode
   note?: string
   stopsNote?: string
}

export type PortfolioLayout = ComponentType<{ children: ReactNode, name: string, trailing?: ReactNode }>

interface PortfoliosPageProps {
   layout: PortfolioLayout
   storageKey: string
   venues: [PortfolioVenue, ...PortfolioVenue[]]
}

const EXPIRY_WARNING_MS = 14 * 24 * 60 * 60 * 1000

export default function PortfoliosPage({ layout: Layout, storageKey, venues }: PortfoliosPageProps) {

   const [venueId, setVenueId] = usePersistentState<VenueId>(storageKey, venues[0].id)
   const current = venues.find(({ id }) => id === venueId) ?? venues[0]
   const { id: venue, label, apiBase, live } = current
   const { configured, unreachable, isLoading: isLoadingSettings } = useProvider(venue)

   const { data: overview, error, trigger: fetchOverview, isMutating, reset } =
      useMutation<PortfolioOverviewResponse>(`${apiBase}/overview`)
   const { trigger: archive, isMutating: isArchiving } =
      useMutation<PortfolioArchiveResponse, PortfolioArchiveRequest>(`${apiBase}/archive`)
   const { trigger: acknowledgeStop } =
      useMutation<PortfolioStopAckResponse, PortfolioStopAckRequest>(`${apiBase}/stops/ack`)

   const [editing, setEditing] = useState<{ portfolio: PortfolioSummary | null } | null>(null)
   const [depositing, setDepositing] = useState<PortfolioSummary | null>(null)
   const [withdrawing, setWithdrawing] = useState<PortfolioSummary | null>(null)
   const [planning, setPlanning] = useState<PlanTarget | null>(null)
   const [viewingHistory, setViewingHistory] = useState<PortfolioSummary | null>(null)
   const [archiving, setArchiving] = useState<PortfolioSummary | null>(null)
   const [adjusting, setAdjusting] = useState<AccountCoin | null>(null)
   const [watchingRun, setWatchingRun] = useState(false)

   const refresh = () => fetchOverview().catch(() => {})

   const fetchedFor = useRef<string | null>(null)

   useEffect(() => {
      if (!configured || fetchedFor.current === venue) return
      fetchedFor.current = venue
      reset()
      refresh()
   }, [venue, configured])

   const rebalance = (portfolio: PortfolioSummary) =>
      setPlanning({ portfolio, request: { portfolioId: portfolio.id, kind: 'rebalance' } })

   const dismissStopFill = async (orderLinkId: string) => {
      try {
         await acknowledgeStop({ orderLinkId })
         refresh()
      }
      catch (reason) {
         toast.error(typeof reason === 'string' ? reason : 'The stop could not be dismissed.')
      }
   }

   const venueToggle = venues.length > 1 &&
      <Tabs value={venue} onValueChange={value => setVenueId(value as VenueId)}>
         <TabsList>
            {venues.map(({ id, tab }) => <TabsTrigger key={id} value={id}>{tab}</TabsTrigger>)}
         </TabsList>
      </Tabs>

   const liveStatus = (
      <div className="flex items-center gap-1 text-xs whitespace-nowrap text-muted-foreground">
         {overview?.fetchedAt &&
            <span title={`${asLocalTimestamp(overview.fetchedAt)} · ${asUtcTimestamp(overview.fetchedAt)} UTC`}>
               Last fetched from {label}: {formatDistanceToNow(overview.fetchedAt)} ago
            </span>}
         <Button
            variant="ghost"
            size="icon-xs"
            type="button"
            disabled={isMutating || !configured}
            className="text-muted-foreground hover:text-foreground"
            onClick={refresh}>
            {isMutating ? <Loader2Icon className="size-3.5 animate-spin" /> : <RefreshCwIcon className="size-3.5" />}
            <span className="sr-only">Refresh</span>
         </Button>
      </div>
   )

   if (!isLoadingSettings && (unreachable || !configured)) {
      return (
         <Layout name="Portfolios">
            <div className="space-y-4">
               {venueToggle}
               <CredentialsAlert unreachable={unreachable}>{current.setup}</CredentialsAlert>
            </div>
         </Layout>
      )
   }

   const portfolios = overview?.portfolios ?? []
   const busy = Boolean(overview?.activeRun)
   const runPortfolio = portfolios.find(({ id }) => id === overview?.activeRun?.portfolioId)
   const overallocated = overview?.coins.filter(({ overallocated }) => overallocated) ?? []
   const expiresSoon = overview?.key.expiresAt && overview.key.expiresAt - overview.fetchedAt < EXPIRY_WARNING_MS
   const stopFills = overview?.stopFills ?? []
   const stoppedPortfolio = (portfolioId: number) => portfolios.find(({ id }) => id === portfolioId)

   return (
      <Layout name="Portfolios" trailing={liveStatus}>
         <div className="space-y-6">

            <div className="flex flex-wrap items-center justify-between gap-3">
               {venueToggle}
               {overview && portfolios.length === 0 &&
                  <Alert className="min-w-0 flex-1 basis-64">
                     <AlertDescription>
                        No portfolio on this account yet. Create one, deposit coins that are already on {label}, then
                        rebalance to buy the targets.
                     </AlertDescription>
                  </Alert>}
               <Button className="ml-auto" disabled={!overview} onClick={() => setEditing({ portfolio: null })}>
                  <PlusIcon /> New portfolio
               </Button>
            </div>

            {Boolean(error) &&
               <Alert variant="destructive">
                  <AlertDescription>{String(error)}</AlertDescription>
               </Alert>}

            {isMutating && !overview && <Loader2Icon className="size-5 animate-spin text-muted-foreground" />}

            {overview && !overview.key.canTrade &&
               <Alert variant="destructive">
                  <AlertTitle>This API key cannot trade</AlertTitle>
                  <AlertDescription>
                     Deposits and valuations work, but rebalancing needs the Spot trade permission on the key.
                  </AlertDescription>
               </Alert>}

            {expiresSoon &&
               <Alert>
                  <AlertDescription>
                     This API key expires on {asLongDate(overview.key.expiresAt!)}. Bind it to an IP address on
                     {' '}{label}, or create a new one before then.
                  </AlertDescription>
               </Alert>}

            {overview && overview.reconciled > 0 &&
               <Alert>
                  <AlertDescription>
                     Checked {overview.reconciled} order{overview.reconciled === 1 ? '' : 's'} left over from a run
                     that did not finish, and recorded what filled. Look at the history, then preview again.
                  </AlertDescription>
               </Alert>}

            {stopFills.map(fill =>
               <Alert key={fill.orderLinkId} variant="destructive">
                  <AlertTitle>
                     {fill.asset} was sold by its stop in {fill.portfolioName}
                  </AlertTitle>
                  <AlertDescription>
                     {asQuantity(fill.quantity)} {fill.asset} sold for{' '}
                     {asQuoteAmount(fill.proceeds, stoppedPortfolio(fill.portfolioId)?.quoteAsset ?? current.quoteAsset)}.
                     {' '}The coin was dropped from the targets and its weight moved to cash. Rebalance when you
                     are ready, and add the coin back by hand if you want it again.
                  </AlertDescription>
                  <AlertAction>
                     <div className="flex flex-wrap gap-2">
                        {stoppedPortfolio(fill.portfolioId) &&
                           <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => rebalance(stoppedPortfolio(fill.portfolioId)!)}>
                              Rebalance now
                           </Button>}
                        <Button size="sm" variant="ghost" onClick={() => dismissStopFill(fill.orderLinkId)}>
                           Dismiss
                        </Button>
                     </div>
                  </AlertAction>
               </Alert>)}

            {overview && !overview.hardStops &&
               <Alert>
                  <AlertDescription>
                     {label} does not accept stop orders, so stop prices are kept but nothing rests on the
                     exchange.
                  </AlertDescription>
               </Alert>}

            {overview?.stopsSyncing &&
               <Alert>
                  <Loader2Icon className="animate-spin" />
                  <AlertDescription>
                     The stop orders are being brought in line with the targets. Refresh in a moment to see them.
                  </AlertDescription>
               </Alert>}

            {overview?.activeRun &&
               <Alert>
                  <Loader2Icon className="animate-spin" />
                  <AlertTitle>Orders are being placed for {runPortfolio?.name ?? 'a portfolio'}</AlertTitle>
                  <AlertDescription>Other actions wait until the run finishes.</AlertDescription>
                  <AlertAction>
                     <Button size="sm" variant="outline" onClick={() => setWatchingRun(true)}>Show progress</Button>
                  </AlertAction>
               </Alert>}

            {overallocated.map(coin =>
               <Alert key={coin.asset} variant="destructive">
                  <AlertTitle>Your portfolios hold more {coin.asset} than the wallet</AlertTitle>
                  <AlertDescription>
                     {coin.allocated} {coin.asset} is assigned to portfolios, but the wallet only has {coin.wallet}.
                     Sells are capped at what is really there. Record the difference to fix it.
                  </AlertDescription>
                  <AlertAction>
                     <Button size="sm" variant="outline" onClick={() => setAdjusting(coin)}>Adjust</Button>
                  </AlertAction>
               </Alert>)}

            {overview && current.note &&
               <Alert>
                  <AlertDescription>{current.note}</AlertDescription>
               </Alert>}

            {current.stopsNote && overview?.hardStops && portfolios.some(({ stops }) => stops.length > 0) &&
               <Alert>
                  <AlertDescription>{current.stopsNote}</AlertDescription>
               </Alert>}

            {portfolios.map(portfolio =>
               <PortfolioCard
                  key={portfolio.id}
                  portfolio={portfolio}
                  busy={busy}
                  onDeposit={() => setDepositing(portfolio)}
                  onWithdraw={() => setWithdrawing(portfolio)}
                  onRebalance={() => rebalance(portfolio)}
                  onEdit={() => setEditing({ portfolio })}
                  onHistory={() => setViewingHistory(portfolio)}
                  onArchive={() => setArchiving(portfolio)} />)}

            {overview && <AccountSummary overview={overview} label={label} />}
         </div>

         <PortfolioEditorDialog
            apiBase={apiBase}
            quoteAsset={current.quoteAsset}
            open={editing !== null}
            portfolio={editing?.portfolio ?? null}
            onOpenChange={open => !open && setEditing(null)}
            onSaved={() => {
               setEditing(null)
               refresh()
            }} />

         <DepositDialog
            apiBase={apiBase}
            venueLabel={label}
            wallet={current.wallet}
            portfolio={depositing}
            coins={overview?.coins ?? []}
            onOpenChange={open => !open && setDepositing(null)}
            onDeposited={(portfolio, asset, amount) => {
               setDepositing(null)
               refresh()
               toast.success(`${amount} ${asset} deposited into ${portfolio.name}.`, {
                  action: { label: 'Rebalance now', onClick: () => rebalance(portfolio) }
               })
            }} />

         <WithdrawDialog
            venueLabel={label}
            portfolio={withdrawing}
            onOpenChange={open => !open && setWithdrawing(null)}
            onPreview={(portfolio, request) => {
               setWithdrawing(null)
               setPlanning({ portfolio, request })
            }} />

         <PlanDialog
            apiBase={apiBase}
            venueLabel={label}
            live={live}
            target={planning}
            onOpenChange={open => !open && setPlanning(null)}
            onFinished={refresh} />

         <HistoryDialog
            apiBase={apiBase}
            portfolio={viewingHistory}
            onOpenChange={open => !open && setViewingHistory(null)} />

         <ArchiveDialog
            portfolio={archiving}
            isArchiving={isArchiving}
            onOpenChange={() => setArchiving(null)}
            onConfirm={async () => {
               if (!archiving) return
               try {
                  await archive({ portfolioId: archiving.id })
                  toast.success(`${archiving.name} archived.`)
                  setArchiving(null)
                  refresh()
               }
               catch (reason) {
                  toast.error(typeof reason === 'string' ? reason : 'The portfolio could not be archived.')
               }
            }} />

         <AdjustDialog
            apiBase={apiBase}
            coin={adjusting}
            portfolios={portfolios}
            onOpenChange={open => !open && setAdjusting(null)}
            onAdjusted={() => {
               setAdjusting(null)
               refresh()
            }} />

         <Dialog open={watchingRun && Boolean(overview?.activeRun)} onOpenChange={setWatchingRun}>
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
               <DialogHeader>
                  <DialogTitle>Orders for {runPortfolio?.name ?? 'a portfolio'}</DialogTitle>
                  <DialogDescription>Sells first, then buys sized to the cash the sells raised.</DialogDescription>
               </DialogHeader>
               {overview?.activeRun &&
                  <RunProgress
                     apiBase={apiBase}
                     runId={overview.activeRun.id}
                     quoteAsset={runPortfolio?.quoteAsset ?? current.quoteAsset}
                     onDone={refresh} />}
            </DialogContent>
         </Dialog>
      </Layout>
   )
}
