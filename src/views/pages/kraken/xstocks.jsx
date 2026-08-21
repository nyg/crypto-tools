import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { toast } from 'sonner'
import { Loader2Icon, SparklesIcon, SearchIcon } from 'lucide-react'
import KrakenLayout from '../../components/kraken/kraken-layout'
import XStockTable from '../../components/kraken/xstock-table'
import XStockJobProgress, { describingTickers, isJobRunning, jobCounts, jobVerbs } from '../../components/kraken/xstock-job'
import Field from '../../components/lib/field'
import NumericInput from '../../components/lib/numeric-input'
import SelectField from '../../components/lib/select-field'
import { asCount, ANY } from '../../components/lib/filter-options'
import { useProvider } from '../../lib/use-settings'
import usePersistentState from '../../lib/use-persistent-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

const PAGE_SIZE = 50
const SETTINGS_KEY = 'kraken.xstocks.settings'
const JOB_KEY = '/api/kraken/xstocks/job'

const typeOptions = [
   { value: ANY, label: 'All types' },
   { value: 'etf', label: 'ETFs' },
   { value: 'stock', label: 'Stocks' },
   { value: 'unknown', label: 'Unknown' },
   { value: 'unclassified', label: 'Unclassified' }
]

const scopeOptions = [
   { value: 'etf', label: 'ETFs' },
   { value: 'stock', label: 'Stocks' },
   { value: 'all', label: 'All listings' }
]

const scopeValues = new Set(scopeOptions.map(option => option.value))

const inScope = (listing, scope) => scope === 'all' || listing.type === scope

const numericColumns = new Set(['volumeUsd24h'])

const collator = new Intl.Collator(undefined, { sensitivity: 'base' })

const defaultSettings = {
   wordCount: 60,
   type: ANY,
   scope: 'etf',
   sort: { column: 'volumeUsd24h', direction: 'desc' }
}

const reviveSettings = (stored, defaults) => ({
   ...stored,
   scope: scopeValues.has(stored.scope) ? stored.scope : defaults.scope
})

function announce(job) {

   const verbs = jobVerbs[job.kind] ?? jobVerbs.describe
   const { done, failed } = jobCounts(job)

   if (job.phase === 'error') {
      return toast.error(job.error ?? `Could not ${verbs.action} those listings.`)
   }

   if (done === 0) {
      return toast.info(job.phase === 'cancelled'
         ? 'Stopped before anything was generated.'
         : `Nothing was ${verbs.past.toLowerCase()}.`)
   }

   const summary = `${verbs.past} ${asCount(done, 'listing')}`

   if (job.phase === 'cancelled') return toast.info(`${summary} before stopping.`)
   if (failed > 0) return toast.warning(`${summary}, ${failed} failed.`)

   toast.success(`${summary}.`)
}

export default function KrakenXStocks() {

   const { configured: hasAnthropicKey } = useProvider('anthropic')

   const [settings, setSettings] = usePersistentState(SETTINGS_KEY, defaultSettings, reviveSettings)
   const { wordCount, type, scope, sort } = settings

   const updateSettings = patch => setSettings(previous => ({ ...previous, ...patch }))

   const [wordCountInput, setWordCountInput] = useState(() => String(wordCount))
   const [searchInput, setSearchInput] = useState('')
   const [search, setSearch] = useState('')
   const [page, setPage] = useState(0)

   const startedRef = useRef(false)
   const settledRef = useRef(0)

   useEffect(() => {
      const timer = setTimeout(() => {
         setSearch(searchInput.trim().toLowerCase())
         setPage(0)
      }, 300)
      return () => clearTimeout(timer)
   }, [searchInput])

   useEffect(() => {
      const timer = setTimeout(() => {
         updateSettings({ wordCount: Math.min(300, Math.max(10, parseInt(wordCountInput) || 60)) })
      }, 500)
      return () => clearTimeout(timer)
   }, [wordCountInput])

   const changeType = (value) => {
      updateSettings({ type: value })
      setPage(0)
   }

   const changeSort = (value) => {
      updateSettings({ sort: value })
      setPage(0)
   }

   const { data, error, isLoading, mutate } = useSWR(['/api/kraken/xstocks/listings', { wordCount }])

   const { trigger: describe } = useSWRMutation('/api/kraken/xstocks/describe')
   const { trigger: classify } = useSWRMutation('/api/kraken/xstocks/classify')
   const { trigger: cancel } = useSWRMutation('/api/kraken/xstocks/job/cancel')

   const { data: jobData, mutate: mutateJob } = useSWR(JOB_KEY, {
      refreshInterval: latest => isJobRunning(latest?.job) ? 1000 : 0,
      onSuccess: (latest) => {
         const latestJob = latest?.job ?? null

         if (isJobRunning(latestJob)) {
            startedRef.current = true

            const settled = jobCounts(latestJob).settled
            if (settled !== settledRef.current) {
               settledRef.current = settled
               mutate()
            }
            return
         }

         if (!startedRef.current) return

         startedRef.current = false
         settledRef.current = 0
         mutate()
         if (latestJob) announce(latestJob)
      }
   })

   const job = jobData?.job ?? null

   const listings = useMemo(() => data?.listings ?? [], [data])

   const counts = useMemo(() => ({
      total: listings.length,
      stocks: listings.filter(listing => listing.type === 'stock').length,
      etfs: listings.filter(listing => listing.type === 'etf').length,
      unclassified: listings.filter(listing => listing.type === 'unclassified').length,
      described: listings.filter(listing => listing.description).length
   }), [listings])

   const filtered = useMemo(() => {
      const matches = listings.filter(listing => {
         if (type !== ANY && listing.type !== type) return false
         if (!search) return true
         return listing.ticker.toLowerCase().includes(search)
            || listing.altname.toLowerCase().includes(search)
            || listing.name.toLowerCase().includes(search)
      })

      const direction = sort.direction === 'asc' ? 1 : -1

      return matches.sort((a, b) => {
         if (numericColumns.has(sort.column)) {
            const left = a[sort.column]
            const right = b[sort.column]
            if (left === null && right === null) return collator.compare(a.ticker, b.ticker)
            if (left === null) return 1
            if (right === null) return -1
            return (left - right) * direction || collator.compare(a.ticker, b.ticker)
         }
         return collator.compare(a[sort.column] ?? '', b[sort.column] ?? '') * direction
            || collator.compare(a.ticker, b.ticker)
      })
   }, [listings, search, type, sort])

   const isFiltered = search !== '' || type !== ANY
   const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

   const startJob = (tickers, kind, trigger) => {

      if (tickers.length === 0) return toast.info(`Nothing to ${jobVerbs[kind].action}.`)

      settledRef.current = 0

      trigger({ tickers, wordCount })
         .then(() => mutateJob())
         .catch(reason => toast.error(typeof reason === 'string'
            ? reason
            : `Could not start ${jobVerbs[kind].gerund}.`))
   }

   const generateDescriptions = (tickers) => startJob(tickers, 'describe', describe)

   const classifyUnknown = () => startJob(
      listings.filter(listing => listing.type === 'unclassified').map(listing => listing.ticker),
      'classify',
      classify)

   const describeScope = () =>
      generateDescriptions(listings
         .filter(listing => inScope(listing, scope) && !listing.description)
         .map(listing => listing.ticker))

   const stop = () => cancel().then(() => mutateJob()).catch(() => {})

   const isBusy = isJobRunning(job)
   const isGenerating = isBusy && job.kind === 'describe'
   const canDescribe = hasAnthropicKey && !isBusy
   const describing = describingTickers(job)

   const pendingInScope = useMemo(
      () => listings.filter(listing => inScope(listing, scope) && !listing.description).length,
      [scope, listings])

   let tableContent
   if (error) {
      tableContent = <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
   }
   else if (isLoading) {
      tableContent = (
         <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Loading Kraken&apos;s tokenized listings…
         </span>
      )
   }
   else {
      tableContent = (
         <XStockTable
            listings={visible}
            total={filtered.length}
            isFiltered={isFiltered}
            page={page}
            pageSize={PAGE_SIZE}
            sort={sort}
            onSortChange={changeSort}
            onPageChange={setPage}
            onDescribe={generateDescriptions}
            describing={describing}
            canDescribe={canDescribe} />
      )
   }

   return (
      <KrakenLayout name="xStocks">
         <div className="space-y-6">

            {counts.unclassified > 0 && !isLoading &&
               <Alert>
                  <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-2">
                     <span>
                        {asCount(counts.unclassified, 'listing')} not in the reference list — Kraken has
                        added them since it was last refreshed.
                     </span>
                     {hasAnthropicKey
                        ? <Button variant="outline" size="sm" type="button" disabled={isBusy} onClick={classifyUnknown}>
                           <SparklesIcon className="size-3.5" />
                           Classify with Claude
                        </Button>
                        : <Link to="/settings" className="font-medium text-foreground underline underline-offset-4">
                           Add an Anthropic API key
                        </Link>}
                  </AlertDescription>
               </Alert>}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">

               <Card>
                  <CardHeader>
                     <CardTitle>Descriptions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                     <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                        <SelectField
                           name="scope"
                           label="Generate for"
                           className="min-w-44 flex-1"
                           value={scope}
                           onValueChange={value => updateSettings({ scope: value })}
                           options={scopeOptions} />
                        <NumericInput
                           name="wordCount"
                           label="Words per description"
                           className="min-w-44 flex-1"
                           value={wordCountInput}
                           onChange={(event) => setWordCountInput(event.target.value)} />
                        <Button
                           type="button"
                           disabled={!canDescribe || pendingInScope === 0}
                           onClick={describeScope}>
                           {isGenerating
                              ? <Loader2Icon className="size-3.5 animate-spin" />
                              : <SparklesIcon className="size-3.5" />}
                           {isGenerating ? 'Generating…' : 'Generate'}
                        </Button>
                        {isBusy &&
                           <Button variant="ghost" type="button" onClick={stop}>
                              Stop
                           </Button>}
                     </div>

                     <XStockJobProgress job={job} />

                     {!hasAnthropicKey &&
                        <Alert>
                           <AlertDescription>
                              Add an Anthropic API key in{' '}
                              <Link to="/settings" className="font-medium text-foreground underline underline-offset-4">
                                 Settings
                              </Link>{' '}
                              to generate descriptions. Everything else on this page works without one.
                           </AlertDescription>
                        </Alert>}

                  </CardContent>
               </Card>

               <Card className="lg:w-72">
                  <CardContent className="grid grid-cols-2 gap-4">
                     <Field label="Listings">{counts.total}</Field>
                     <Field label="Stocks">{counts.stocks}</Field>
                     <Field label="ETFs">{counts.etfs}</Field>
                     <Field label="Described" title={`At ${wordCount} words`}>
                        {counts.described} / {counts.total}
                     </Field>
                  </CardContent>
               </Card>

            </div>

            <Card>
               <CardHeader>
                  <CardTitle>Listings</CardTitle>
                  <CardAction>
                     {isLoading
                        ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                        : <Badge variant="outline">{asCount(filtered.length, 'listing')}</Badge>}
                  </CardAction>
               </CardHeader>
               <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 items-end gap-x-4 gap-y-3 md:grid-cols-3 lg:grid-cols-4">
                     <div className="space-y-1">
                        <Label htmlFor="search" className="pl-2.5 text-xs">Search</Label>
                        <div className="relative">
                           <SearchIcon className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                           <Input
                              id="search"
                              name="search"
                              className="pl-8"
                              placeholder="Ticker or name"
                              value={searchInput}
                              onChange={(event) => setSearchInput(event.target.value)} />
                        </div>
                     </div>
                     <SelectField
                        name="type"
                        label="Type"
                        value={type}
                        onValueChange={changeType}
                        options={typeOptions} />
                  </div>
                  {tableContent}
               </CardContent>
            </Card>

         </div>
      </KrakenLayout>
   )
}
