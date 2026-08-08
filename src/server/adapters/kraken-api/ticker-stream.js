const SOCKET_URL = 'wss://ws.kraken.com/v2'
const SUBSCRIBE_CHUNK = 50
const SNAPSHOT_TIMEOUT_MS = 8000

export function fetchTickerSnapshots(symbols) {

   if (symbols.length === 0) return Promise.resolve(new Map())

   return new Promise(resolve => {

      const snapshots = new Map()
      let socket = null
      let timer = null

      const settle = () => {
         clearTimeout(timer)
         try { socket?.close() }
         catch { /* already closing */ }
         resolve(snapshots)
      }

      try {
         socket = new WebSocket(SOCKET_URL)
      }
      catch (error) {
         console.log('Could not open the Kraken ticker socket:', error.message)
         return resolve(snapshots)
      }

      timer = setTimeout(() => {
         console.log(`Kraken ticker snapshot timed out with ${snapshots.size}/${symbols.length} symbols`)
         settle()
      }, SNAPSHOT_TIMEOUT_MS)

      socket.addEventListener('open', () => {
         for (let index = 0; index < symbols.length; index += SUBSCRIBE_CHUNK) {
            socket.send(JSON.stringify({
               method: 'subscribe',
               params: {
                  channel: 'ticker',
                  symbol: symbols.slice(index, index + SUBSCRIBE_CHUNK),
                  snapshot: true
               }
            }))
         }
      })

      socket.addEventListener('message', event => {
         let message
         try { message = JSON.parse(event.data) }
         catch { return }

         if (message.channel !== 'ticker' || !Array.isArray(message.data)) return

         for (const entry of message.data) {
            if (entry?.symbol) snapshots.set(entry.symbol, entry)
         }

         if (snapshots.size >= symbols.length) settle()
      })

      socket.addEventListener('error', () => {
         console.log('The Kraken ticker socket errored before every snapshot arrived')
         settle()
      })

      socket.addEventListener('close', () => {
         clearTimeout(timer)
         resolve(snapshots)
      })
   })
}
