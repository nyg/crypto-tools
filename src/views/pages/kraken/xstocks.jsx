import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { toast } from 'sonner'
import { Loader2Icon, SparklesIcon, SearchIcon } from 'lucide-react'
import KrakenLayout from '../../components/kraken/kraken-layout'
import InfoBanner from '../../components/lib/info-banner'
import XStockTable from '../../components/kraken/xstock-table'
import Field from '../../components/lib/field'
import NumericInput from '../../components/lib/numeric-input'
import SelectField from '../../components/lib/select-field'
import { asCount, ANY } from '../../components/lib/filter-options'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

const PAGE_SIZE = 50
const BATCH_SIZE = 20

const typeOptions = [
   { value: ANY, label: 'All types' },
   { value: 'etf', label: 'ETFs' },
   { value: 'stock', label: 'Stocks' },
   { value: 'unknown', label: 'Unknown' },
   { value: 'unclassified', label: 'Unclassified' }
]

const scopeOptions = [
   { value: 'etf', label: 'ETFs only' },
   { value: 'filtered', label: 'Everything in view' },
   { value: 'all', label: 'Every listing' }
]

const collator = new Intl.Collator(undefined, { sensitivity: 'base' })

export default function KrakenXStocks() {

   const [credentials] = useState(() => ({
      apiKey: (typeof window !== 'undefined' && localStorage.getItem('anthropic.api.key')) || ''
   }))

   const [wordCountInput, setWordCountInput] = useState('60')
   const [wordCount, setWordCount] = useState(60)
   const [searchInput, setSearchInput] = useState('')
   const [search, setSearch] = useState('')
   const [type, setType] = useState(ANY)
   const [scope, setScope] = useState('etf')
   const [sort, setSort] = useState({ column: 'ticker', direction: 'asc' })
   const [page, setPage] = useState(0)
   const [describing, setDescribing] = useState(() => new Set())
   const [progress, setProgress] = useState(null)

   const stopRequested = useRef(false)

   useEffect(() => {
      const timer = setTimeout(() => {
         setSearch(searchInput.trim().toLowerCase())
         setPage(0)
      }, 300)
      return () => clearTimeout(timer)
   }, [searchInput])

   useEffect(() => {
      const timer = setTimeout(() => {
         const parsed = Math.min(300, Math.max(10, parseInt(wordCountInput) || 60))
         setWordCount(parsed)
      }, 500)
      return () => clearTimeout(timer)
   }, [wordCountInput])

   const changeType = (value) => {
      setType(value)
      setPage(0)
   }

   const changeSort = (value) => {
      setSort(value)
      setPage(0)
   }

   const { data, error, isLoading, mutate } = useSWR(['/api/kraken/xstocks/listings', { wordCount }])

   const { trigger: describe } = useSWRMutation('/api/kraken/xstocks/describe')
   const { trigger: classify } = useSWRMutation('/api/kraken/xstocks/classify')

   const listings = useMemo(() => data?.listings ?? [], [data])

   const counts = useMemo(() => ({
      total: listings.length,
      stocks: listings.filter(listing => listing.type === 'stock').length,
      etfs: listings.filter(listing => listing.type === 'etf').length,
      unclassified: listings.filter(listing => listing.type === 'unclassified' || listing.type === 'unknown').length,
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
      return matches.sort((a, b) =>
         collator.compare(a[sort.column] ?? '', b[sort.column] ?? '') * direction
         || collator.compare(a.ticker, b.ticker))
   }, [listings, search, type, sort])

   const isFiltered = search !== '' || type !== ANY
   const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

   const runInBatches = async (tickers, label, worker) => {

      if (tickers.length === 0) {
         toast.info(`Nothing to ${label}.`)
         return
      }

      stopRequested.current = false
      setProgress({ done: 0, total: tickers.length })

      for (let index = 0; index < tickers.length; index += BATCH_SIZE) {
         if (stopRequested.current) break

         const batch = tickers.slice(index, index + BATCH_SIZE)
         setDescribing(new Set(batch))

         try {
            await worker(batch)
         }
         catch (reason) {
            toast.error(typeof reason === 'string' ? reason : `Could not ${label} those listings.`)
            break
         }

         setProgress({ done: Math.min(index + BATCH_SIZE, tickers.length), total: tickers.length })
         await mutate()
      }

      setDescribing(new Set())
      setProgress(null)
   }

   const generateDescriptions = (tickers) =>
      runInBatches(tickers, 'describe', batch => describe({ credentials, tickers: batch, wordCount }))

   const classifyUnknown = () =>
      runInBatches(
         listings.filter(listing => listing.type === 'unclassified').map(listing => listing.ticker),
         'classify',
         batch => classify({ credentials, tickers: batch }))

   const describeScope = () => {
      const pool = scope === 'filtered' ? filtered : listings
      const wanted = scope === 'etf'
         ? pool.filter(listing => listing.type === 'etf')
         : pool
      return generateDescriptions(wanted.filter(listing => !listing.description).map(listing => listing.ticker))
   }

   const isBusy = progress !== null
   const canDescribe = Boolean(credentials.apiKey) && !isBusy

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

            <InfoBanner>
               Kraken&apos;s tokenized stocks and ETFs. Which listings are stocks and which are ETFs
               comes from a reference list shipped with the app, so it loads instantly and costs
               nothing. Descriptions are written by Claude only when you ask for them, billed to your
               Anthropic account, and cached afterwards. They are descriptive and are not investment
               advice.
            </InfoBanner>

            {counts.unclassified > 0 && !isLoading &&
               <Alert>
                  <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-2">
                     <span>
                        {asCount(counts.unclassified, 'listing')} not in the reference list — Kraken has
                        added them since it was last refreshed.
                     </span>
                     {credentials.apiKey
                        ? <Button variant="outline" size="sm" type="button" disabled={isBusy} onClick={classifyUnknown}>
                           <SparklesIcon className="size-3.5" />
                           Classify with Claude
                        </Button>
                        : <Link to="/settings" className="font-medium text-foreground underline underline-offset-4">
                           Add an Anthropic API key
                        </Link>}
                  </AlertDescription>
               </Alert>}

            <Card size="sm">
               <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Field label="Listings">{counts.total}</Field>
                  <Field label="Stocks">{counts.stocks}</Field>
                  <Field label="ETFs">{counts.etfs}</Field>
                  <Field label="Described" title={`At ${wordCount} words`}>
                     {counts.described} / {counts.total}
                  </Field>
               </CardContent>
            </Card>

            <Card size="sm">
               <CardHeader>
                  <CardTitle>Descriptions</CardTitle>
               </CardHeader>
               <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 items-end gap-x-4 gap-y-3 md:grid-cols-3 lg:grid-cols-4">
                     <SelectField
                        name="scope"
                        label="Generate for"
                        value={scope}
                        onValueChange={setScope}
                        options={scopeOptions} />
                     <NumericInput
                        name="wordCount"
                        label="Words per description"
                        value={wordCountInput}
                        onChange={(event) => setWordCountInput(event.target.value)} />
                  </div>

                  {!credentials.apiKey &&
                     <Alert>
                        <AlertDescription>
                           Add an Anthropic API key in{' '}
                           <Link to="/settings" className="font-medium text-foreground underline underline-offset-4">
                              Settings
                           </Link>{' '}
                           to generate descriptions. Everything else on this page works without one.
                        </AlertDescription>
                     </Alert>}

                  <div className="flex flex-wrap items-center gap-3">
                     <Button
                        type="button"
                        size="sm"
                        disabled={!canDescribe}
                        onClick={describeScope}>
                        <SparklesIcon className="size-3.5" />
                        Generate
                     </Button>
                     {isBusy &&
                        <>
                           <span className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2Icon className="size-4 animate-spin" />
                              {progress.done} of {progress.total} done…
                           </span>
                           <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              onClick={() => { stopRequested.current = true }}>
                              Stop
                           </Button>
                        </>}
                  </div>
               </CardContent>
            </Card>

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
