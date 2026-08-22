import { useState } from 'react'
import { ChevronDownIcon, ChevronRightIcon, DownloadIcon, Loader2Icon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell } from '@/components/ui/table'
import BalanceFilters, { EARNING, dustLimit } from './balance-filters'
import { migrationNote } from './asset-migrations'
import { PLACEMENT_ORDER, isEarning, placementColor, placementDescription, placementLabel, placementOf } from './placement'
import { asCount } from '../lib/filter-options'
import { asAssetAmount, asDollarAmount, asPercentage } from '../../../utils/format'
import SortIcon from '../lib/sort-icon'

// An asset Kraken has no USD pair for has no rate at all, which is not the same as
// being worth nothing: it is shown as a dash, left out of the totals, and sorted last
// whichever column is sorted on.
const valueOf = (amount, rate) => rate == null ? null : (amount ?? 0) * rate

// The names Kraken gave a position while it was staked the old way — DOT.S, ETH2.S,
// USD.M. They are the reason a holding can read as one asset on Kraken and another
// here, so they are shown; the plain ticker alongside them says nothing.
const suffixedNames = position => position.rawAssets.filter(name => name.includes('.'))

// Asset and amount, semicolon-separated like the export this page used to serve from
// the server. The amount is the exact string the ledger stores rather than the rounded,
// thousand-separated one in the table: this file is meant to be read by something else.
function downloadCsv(rows) {

   const csv = ['asset;amount', ...rows.map(row => `${row.asset};${row.exact}`)].join('\n')
   const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))

   const link = document.createElement('a')
   link.href = url
   link.download = `kraken-balances-${new Date().toISOString().slice(0, 10)}.csv`
   link.click()

   URL.revokeObjectURL(url)
}

function SortableHead({ column, sort, onSortChange, align, children }) {
   const isActive = sort.column === column
   return (
      <TableHead className={align === 'right' ? 'text-right' : undefined}>
         <button
            type="button"
            className={cn('inline-flex w-full items-center gap-1 hover:text-foreground',
               align === 'right' && 'justify-end',
               isActive && 'font-semibold text-foreground')}
            onClick={() => onSortChange({
               column,
               direction: isActive && sort.direction === 'desc' ? 'asc' : 'desc'
            })}>
            {children}
            <SortIcon isActive={isActive} direction={sort.direction} />
         </button>
      </TableHead>
   )
}

function AssetName({ asset }) {

   const note = migrationNote(asset)

   return (
      <span
         className={note ? 'cursor-help underline decoration-dotted underline-offset-2' : undefined}
         title={note ?? undefined}>
         {asset}
      </span>
   )
}

// The badge carries the colour its slice has in the ring above, so a row can be read
// against the chart without a legend, and its title spells out what the placement
// actually means — which is the part Kraken never says.
function PlacementBadge({ position }) {

   const key = placementOf(position)

   return (
      <Badge
         variant="outline"
         className="gap-1.5 font-normal"
         title={placementDescription(key)}>
         <span
            className="size-2 shrink-0 rounded-[2px]"
            style={{ backgroundColor: placementColor(key) }} />
         {placementLabel(key, position)}
      </Badge>
   )
}


export default function BalanceTable({ balances, rates, live, filters, onFiltersChange, onReset, isLoading }) {

   // Sorting is local: every row is already on the page, so re-ordering costs no
   // request and there is nothing to page through.
   const [sort, setSort] = useState({ column: 'value', direction: 'desc' })
   const [expanded, setExpanded] = useState(() => new Set())

   const assets = balances?.assets ?? []
   const rateFor = asset => rates?.[asset] ?? null

   const holds = new Map((live?.assets ?? []).map(asset => [asset.asset, asset.holdNum]))

   // Share is of the whole portfolio, not of what the filters left behind: an asset
   // does not become a bigger part of the holdings because the others were hidden.
   const portfolioValue = assets
      .reduce((sum, asset) => sum + (valueOf(asset.totalNum, rateFor(asset.asset)) ?? 0), 0)

   // Filtering by placement narrows the positions themselves, so that "Earn · Locked"
   // shows what is locked rather than every asset that happens to have some locked.
   const rows = assets
      .map(asset => {
         // Ordered the way the ring above is, so a row's badges and the legend read in
         // the same sequence rather than each by its own size.
         const positions = asset.positions
            .filter(position => matchesPlacement(position, filters.placement))
            .toSorted((a, b) => PLACEMENT_ORDER.indexOf(placementOf(a)) - PLACEMENT_ORDER.indexOf(placementOf(b)))
         const amount = positions.reduce((sum, position) => sum + position.amountNum, 0)
         return {
            asset: asset.asset,
            positions,
            amount,
            // The exact string Kraken wrote, kept for the cell's title: the column is
            // rounded to stay readable, and a tenth of a bitcoin is worth seeing.
            exact: positions.length === asset.positions.length ? asset.total
               : positions.length === 1 ? positions[0].amount : String(amount),
            rate: rateFor(asset.asset),
            value: valueOf(amount, rateFor(asset.asset)),
            hold: holds.get(asset.asset) ?? null
         }
      })
      .filter(row => row.positions.length > 0)
      .filter(row => !filters.asset || row.asset === filters.asset)

   // An asset with no USD pair is never dust: it cannot be valued, so there is no
   // ground to hide it on.
   const limit = dustLimit(filters)
   const isDust = row => limit > 0 && row.value != null && Math.abs(row.value) < limit

   const dust = rows.filter(isDust)
   const shown = rows.filter(row => !isDust(row))

   const sortValue = {
      asset: row => row.asset,
      value: row => row.value,
      hold: row => valueOf(row.hold, row.rate)
   }[sort.column]

   const sorted = shown.toSorted((a, b) => {
      const [left, right] = [sortValue(a), sortValue(b)]
      if (left == null && right == null) return a.asset.localeCompare(b.asset)
      if (left == null) return 1
      if (right == null) return -1
      if (left === right) return a.asset.localeCompare(b.asset)
      const order = typeof left === 'string' ? left.localeCompare(right) : left - right
      return sort.direction === 'desc' ? -order : order
   })

   const shownValue = sorted.reduce((sum, row) => sum + (row.value ?? 0), 0)

   const toggle = asset => setExpanded(current => {
      const next = new Set(current)
      if (!next.delete(asset)) next.add(asset)
      return next
   })

   return (
      <Card>
         <CardHeader>
            <CardTitle>Holdings</CardTitle>
            <CardAction className="flex items-center gap-2">
               {/* Exports what the table is showing, filters and sorting included: the
                   button sits next to the count, and the count is of the same rows. */}
               <Button
                  variant="ghost"
                  size="xs"
                  disabled={sorted.length === 0}
                  onClick={() => downloadCsv(sorted)}>
                  <DownloadIcon className="size-3.5" />
                  Export CSV
               </Button>
               {isLoading
                  ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                  : <Badge variant="outline">{asCount(sorted.length, 'asset')}</Badge>}
            </CardAction>
         </CardHeader>
         <CardContent className="space-y-4">

            <BalanceFilters
               filters={filters}
               options={{
                  assets: assets.map(asset => asset.asset),
                  placements: placementOptions(assets)
               }}
               onChange={onFiltersChange}
               onReset={onReset} />

            {assets.length === 0
               ? <p className="text-sm text-muted-foreground">
                  Nothing held in the stored ledger.
               </p>
               : sorted.length === 0
                  ? <p className="text-sm text-muted-foreground">
                     No asset matches the filters{dust.length > 0
                        ? `, though ${asCount(dust.length, 'asset')} worth under $${limit} ${dust.length === 1 ? 'is' : 'are'} hidden`
                        : ''}.
                  </p>
                  : <div className="space-y-3">
                     <Table className="tabular-nums">
                        <TableHeader>
                           <TableRow>
                              <SortableHead column="asset" sort={sort} onSortChange={setSort}>Asset</SortableHead>
                              <TableHead>Placement</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead className="text-right">Price</TableHead>
                              <SortableHead column="value" sort={sort} onSortChange={setSort} align="right">Value</SortableHead>
                              <TableHead className="text-right">Share</TableHead>
                              <SortableHead column="hold" sort={sort} onSortChange={setSort} align="right">In orders</SortableHead>
                           </TableRow>
                        </TableHeader>
                        <TableBody>
                           {sorted.map(row => {

                              const isExpandable = row.positions.length > 1
                              const isExpanded = isExpandable && expanded.has(row.asset)

                              return [
                                 <TableRow key={row.asset}>
                                    <TableCell className="font-medium">
                                       {isExpandable
                                          ? <button
                                             type="button"
                                             className="inline-flex items-center gap-1 hover:text-foreground"
                                             aria-expanded={isExpanded}
                                             onClick={() => toggle(row.asset)}>
                                             {isExpanded
                                                ? <ChevronDownIcon className="size-3.5" />
                                                : <ChevronRightIcon className="size-3.5" />}
                                             <AssetName asset={row.asset} />
                                          </button>
                                          : <span className="pl-[1.125rem]"><AssetName asset={row.asset} /></span>}
                                    </TableCell>
                                    <TableCell>
                                       <div className="flex flex-wrap gap-1">
                                          {row.positions.map(position =>
                                             <PlacementBadge key={position.wallet} position={position} />)}
                                       </div>
                                    </TableCell>
                                    <TableCell className="text-right" title={`${row.exact} ${row.asset}`}>
                                       {asAssetAmount(row.amount)}
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground">
                                       {row.rate == null ? '—' : asDollarAmount(row.rate)}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                       {row.value == null ? '—' : asDollarAmount(row.value)}
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground">
                                       {row.value == null || portfolioValue <= 0 ? '—' : asPercentage(row.value / portfolioValue)}
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground">
                                       {row.hold ? asAssetAmount(row.hold) : '—'}
                                    </TableCell>
                                 </TableRow>,

                                 ...(isExpanded ? row.positions.map(position =>
                                    <TableRow key={`${row.asset} ${position.wallet}`} className="text-muted-foreground">
                                       <TableCell />
                                       <TableCell className="pl-6 text-xs">
                                          {placementLabel(placementOf(position), position)}
                                          {/* Only the suffixed names, which are the retired staking ones:
                                              a DOT.S line is why an old position reads as one asset on
                                              Kraken and another here. */}
                                          {suffixedNames(position).length > 0 &&
                                             <span className="ml-2 font-mono">{suffixedNames(position).join(' · ')}</span>}
                                       </TableCell>
                                       <TableCell className="text-right" title={`${position.amount} ${row.asset}`}>
                                          {asAssetAmount(position.amountNum)}
                                       </TableCell>
                                       <TableCell />
                                       <TableCell className="text-right">
                                          {valueOf(position.amountNum, row.rate) == null
                                             ? '—'
                                             : asDollarAmount(valueOf(position.amountNum, row.rate))}
                                       </TableCell>
                                       <TableCell colSpan={2} className="text-right text-xs">
                                          {isEarning(placementOf(position)) && position.lastRewardAt
                                             ? `last paid ${new Date(position.lastRewardAt).toISOString().slice(0, 10)}`
                                             : ''}
                                       </TableCell>
                                    </TableRow>) : [])
                              ]
                           })}
                        </TableBody>
                        <TableFooter>
                           <TableRow>
                              <TableCell colSpan={4}>Total</TableCell>
                              <TableCell className="text-right">{asDollarAmount(shownValue)}</TableCell>
                              <TableCell className="text-right">
                                 {portfolioValue > 0 ? asPercentage(shownValue / portfolioValue) : '—'}
                              </TableCell>
                              {/* Left blank on purpose: the column holds amounts of
                                  different coins, which cannot be added up. What they
                                  are worth together is in the summary card. */}
                              <TableCell />
                           </TableRow>
                        </TableFooter>
                     </Table>
                  </div>}

         </CardContent>
      </Card>
   )
}

function matchesPlacement(position, placement) {

   if (!placement) return true

   const key = placementOf(position)
   return placement === EARNING ? isEarning(key) : key === placement
}

// Only the placements this account actually uses: offering "Earn · Bonded" to someone
// who has never bonded anything is a filter that can only ever empty the table.
function placementOptions(assets) {

   const seen = new Map()

   for (const asset of assets) {
      for (const position of asset.positions) {
         const key = placementOf(position)
         if (!seen.has(key)) seen.set(key, { value: key, label: placementLabel(key, position) })
      }
   }

   const named = [...seen.values()].toSorted((a, b) => a.label.localeCompare(b.label))
   const earns = [...seen.keys()].some(isEarning)

   return earns ? [{ value: EARNING, label: 'Any rewards' }, ...named] : named
}
