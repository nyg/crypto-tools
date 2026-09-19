import useSWR from 'swr'
import { Loader2Icon } from 'lucide-react'
import { RunOrdersTable } from './run-progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
   Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { asLocalTimestamp } from '../../../utils/format'
import { asQuantity, asQuoteAmount, runStatusLabels } from './format'
import type { PortfolioHistoryRequest, PortfolioHistoryResponse, PortfolioSummary } from '../../../types/api'
import type { MovementKind } from '../../../types/portfolio'

const movementLabels: Record<MovementKind, string> = {
   deposit: 'Deposit',
   withdraw: 'Withdrawal',
   adjust: 'Adjustment',
   fee: 'Fee'
}

interface HistoryDialogProps {
   apiBase: string
   portfolio: PortfolioSummary | null
   onOpenChange: (open: boolean) => void
}

export default function HistoryDialog({ apiBase, portfolio, onOpenChange }: HistoryDialogProps) {

   const key: [string, PortfolioHistoryRequest] | null =
      portfolio ? [`${apiBase}/history`, { portfolioId: portfolio.id }] : null
   const { data, error, isLoading } = useSWR<PortfolioHistoryResponse>(key, { revalidateOnFocus: false })

   const quote = portfolio?.quoteAsset ?? ''
   const movements = data?.movements.filter(({ kind }) => kind !== 'fee') ?? []

   return (
      <Dialog open={portfolio !== null} onOpenChange={onOpenChange}>
         <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
               <DialogTitle>{portfolio?.name} history</DialogTitle>
               <DialogDescription>
                  Every deposit, withdrawal and run of orders, newest first. Fees are listed with the order that paid them.
               </DialogDescription>
            </DialogHeader>

            {isLoading && <Loader2Icon className="size-5 animate-spin text-muted-foreground" />}

            {Boolean(error) &&
               <Alert variant="destructive">
                  <AlertDescription>{String(error)}</AlertDescription>
               </Alert>}

            {data &&
               <div className="space-y-6">
                  <section className="space-y-2">
                     <h3 className="text-sm font-medium">Money in and out</h3>
                     {movements.length === 0
                        ? <p className="text-sm text-muted-foreground">Nothing yet.</p>
                        : <Table className="tabular-nums">
                           <TableHeader>
                              <TableRow>
                                 <TableHead>When</TableHead>
                                 <TableHead>What</TableHead>
                                 <TableHead className="text-right">Amount</TableHead>
                                 <TableHead className="text-right">Worth then</TableHead>
                              </TableRow>
                           </TableHeader>
                           <TableBody>
                              {movements.map(movement =>
                                 <TableRow key={movement.id}>
                                    <TableCell className="text-muted-foreground">{asLocalTimestamp(movement.createdAt)}</TableCell>
                                    <TableCell>
                                       {movementLabels[movement.kind]}
                                       {movement.note && <span className="ml-2 text-xs text-muted-foreground">{movement.note}</span>}
                                    </TableCell>
                                    <TableCell className="text-right">{asQuantity(movement.amount)} {movement.asset}</TableCell>
                                    <TableCell className="text-right">{asQuoteAmount(movement.value, quote)}</TableCell>
                                 </TableRow>)}
                           </TableBody>
                        </Table>}
                  </section>

                  <section className="space-y-4">
                     <h3 className="text-sm font-medium">Runs</h3>
                     {data.runs.length === 0 && <p className="text-sm text-muted-foreground">No orders placed yet.</p>}
                     {data.runs.map(run =>
                        <div key={run.id} className="space-y-2">
                           <div className="text-sm">
                              <span className="font-medium capitalize">{run.kind}</span>{' '}
                              <span className="text-muted-foreground">
                                 {asLocalTimestamp(run.startedAt)} · {runStatusLabels[run.status]}
                                 {Number(run.withdraw) > 0 && ` · ${asQuoteAmount(run.withdrawn, quote)} withdrawn`}
                              </span>
                           </div>
                           {run.error && <p className="text-xs text-destructive">{run.error}</p>}
                           {run.orders.length > 0 && <RunOrdersTable run={run} quoteAsset={quote} />}
                        </div>)}
                  </section>
               </div>}
         </DialogContent>
      </Dialog>
   )
}
