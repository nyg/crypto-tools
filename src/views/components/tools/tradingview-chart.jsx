import { memo, useEffect, useRef, useState } from 'react'
import ExternalLink from '../lib/external-link'

const SCRIPT_SRC = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
const LOAD_TIMEOUT = 8000
const SYMBOL_DEBOUNCE = 700

function TradingViewChart({ symbol }) {

   const containerRef = useRef(null)
   const [failed, setFailed] = useState(false)
   const [activeSymbol, setActiveSymbol] = useState(symbol)

   useEffect(() => {
      const timer = setTimeout(() => setActiveSymbol(symbol), SYMBOL_DEBOUNCE)
      return () => clearTimeout(timer)
   }, [symbol])

   useEffect(() => {

      const container = containerRef.current
      if (!container || !activeSymbol) return

      setFailed(false)
      container.innerHTML = ''

      const widget = document.createElement('div')
      widget.className = 'tradingview-widget-container__widget h-full w-full'
      container.appendChild(widget)

      const script = document.createElement('script')
      script.src = SCRIPT_SRC
      script.type = 'text/javascript'
      script.async = true
      script.onerror = () => setFailed(true)
      script.innerHTML = JSON.stringify({
         autosize: true,
         symbol: activeSymbol,
         interval: '60',
         timezone: 'Etc/UTC',
         theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
         style: '1',
         locale: 'en',
         allow_symbol_change: false,
         support_host: 'https://www.tradingview.com'
      })
      container.appendChild(script)

      const timer = setTimeout(() => {
         if (!container.querySelector('iframe')) setFailed(true)
      }, LOAD_TIMEOUT)

      return () => {
         clearTimeout(timer)
         container.innerHTML = ''
      }
   }, [activeSymbol])

   if (!activeSymbol) {
      return (
         <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
            Enter a trading pair to show a chart.
         </div>
      )
   }

   return (
      <div className="relative h-full w-full">
         <div ref={containerRef} className="tradingview-widget-container h-full w-full" />
         {failed &&
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-card p-6 text-center text-sm text-muted-foreground">
               <p>The TradingView chart could not be loaded.</p>
               <ExternalLink
                  href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(activeSymbol)}`}
                  className="font-medium text-foreground underline underline-offset-4">
                  Open {activeSymbol} on TradingView
               </ExternalLink>
            </div>}
      </div>
   )
}

export default memo(TradingViewChart)
