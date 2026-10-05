import { useEffect, useRef } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { Loader2Icon, SquareIcon } from 'lucide-react'
import useMutation from '../../lib/use-mutation'
import LoadingSpinner from '../lib/loading-spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import OrderLabel from './order-label'
import { asQuantity, asQuoteAmount, orderStatusLabels, runStatusLabels } from './format'
import type { PortfolioRun, PortfolioRunOrder, PortfolioRunRequest, PortfolioRunResponse } from '../../../types/api'
import type { RunOrderStatus } from '../../../types/portfolio'

const badgeVariant = (status: RunOrderStatus) =>
   status === 'filled' ? 'secondary' : ['rejected', 'failed'].includes(status) ? 'destructive' : 'outline'

const isResting = ({ status, limitPrice }: PortfolioRunOrder) => status === 'placed' && limitPrice !== null

const restingNote = ({ limitPrice, attempts }: PortfolioRunOrder) =>
   `at ${asQuantity(limitPrice)}${attempts > 1 ? `, moved ${attempts - 1}×` : ''}`

export function RunOrdersTable({ run, quoteAsset }: { run: PortfolioRun, quoteAsset: string }) {
   return (
      <Table className="text-[13px] tabular-nums">
         <TableHeader>
            <TableRow>
               <TableHead>Order</TableHead>
               <TableHead className="text-right">Requested</TableHead>
               <TableHead className="text-right">Filled</TableHead>
               <TableHead className="text-right">For</TableHead>
               <TableHead className="text-right">Fees</TableHead>
               <TableHead>Status</TableHead>
            </TableRow>
         </TableHeader>
         <TableBody>
            {run.orders.map(order => {
               const base = order.symbol.replace(new RegExp(`${quoteAsset}$`), '')
               return (
                  <TableRow key={order.orderLinkId}>
                     <TableCell><OrderLabel side={order.side} asset={base} /></TableCell>
                     <TableCell className="text-right">
                        {asQuantity(order.requested)} {order.unit === 'base' ? base : quoteAsset}
                     </TableCell>
                     <TableCell className="text-right">{asQuantity(order.base)} {base}</TableCell>
                     <TableCell className="text-right">{asQuoteAmount(order.quote, quoteAsset)}</TableCell>
                     <TableCell className="text-right text-muted-foreground">
                        {order.fees.length === 0 ? '—' : order.fees.map(fee => `${asQuantity(fee.amount)} ${fee.asset}`).join(', ')}
                     </TableCell>
                     <TableCell>
                        <Badge variant={badgeVariant(order.status)} title={order.error ?? undefined}>
                           {isResting(order) ? 'Resting' : orderStatusLabels[order.status]}
                        </Badge>
                        {isResting(order) &&
                           <div className="mt-1 text-xs text-muted-foreground">{restingNote(order)}</div>}
                        {order.error && <div className="mt-1 max-w-56 text-xs whitespace-normal text-muted-foreground">{order.error}</div>}
                     </TableCell>
                  </TableRow>
               )
            })}
         </TableBody>
      </Table>
   )
}

interface RunProgressProps {
   apiBase: string
   runId: string
   quoteAsset: string
   onDone?: (run: PortfolioRun) => void
}

export default function RunProgress({ apiBase, runId, quoteAsset, onDone }: RunProgressProps) {

   const key: [string, PortfolioRunRequest] = [`${apiBase}/run`, { runId }]
   const { data, error, mutate } = useSWR<PortfolioRunResponse>(key, {
      refreshInterval: latest => latest?.run.running ? 1000 : 0,
      dedupingInterval: 0,
      revalidateOnFocus: false
   })
   const { trigger: stop, isMutating: isStopping } =
      useMutation<PortfolioRunResponse, PortfolioRunRequest>(`${apiBase}/stop`)

   const stopRun = async () => {
      try {
         await stop({ runId })
         mutate()
      }
      catch (reason) {
         toast.error(typeof reason === 'string' ? reason : 'The run could not be stopped.')
      }
   }

   const reported = useRef(false)
   const run = data?.run

   useEffect(() => {
      if (!run || run.running || reported.current) return
      reported.current = true
      onDone?.(run)
   }, [run])

   if (error) {
      return (
         <Alert variant="destructive">
            <AlertDescription>{String(error)}</AlertDescription>
         </Alert>
      )
   }

   if (!run) return <LoadingSpinner />

   const settled = run.orders.filter(({ status }) => !['pending', 'placed', 'unknown'].includes(status)).length

   return (
      <div className="space-y-3">
         <div className="flex items-center gap-2 text-sm">
            {run.running && <Loader2Icon className="size-4 animate-spin" />}
            <span className="font-medium">{runStatusLabels[run.status]}</span>
            <span className="text-muted-foreground">
               {settled} of {run.orders.length} orders settled
               {Number(run.withdraw) > 0 &&
                  ` · ${asQuoteAmount(run.withdrawn, quoteAsset)} of ${asQuoteAmount(run.withdraw, quoteAsset)} withdrawn`}
            </span>
            {run.running &&
               <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  disabled={isStopping || run.stopping}
                  title="Cancels the orders on the book and places no more. What has filled stays filled."
                  onClick={stopRun}>
                  <SquareIcon /> {run.stopping ? 'Stopping…' : 'Stop'}
               </Button>}
         </div>
         {run.error &&
            <Alert variant="destructive">
               <AlertDescription>{run.error}</AlertDescription>
            </Alert>}
         {run.orders.length > 0 && <RunOrdersTable run={run} quoteAsset={quoteAsset} />}
      </div>
   )
}
