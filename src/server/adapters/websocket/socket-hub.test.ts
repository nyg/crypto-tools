import { afterEach, describe, expect, test } from 'bun:test'
import SocketHub from './socket-hub'
import type { Server, ServerWebSocket } from 'bun'
import type { Inbound, SocketProtocol, StreamListener } from './socket-hub'

interface Pushed {
   key: string
   price?: string
   refused?: boolean
}

class FakeFeed {

   readonly server: Server<undefined>
   readonly sockets = new Set<ServerWebSocket<undefined>>()
   readonly received: unknown[] = []
   connections = 0

   constructor() {
      this.server = Bun.serve({
         port: 0,
         fetch: (request, server) => server.upgrade(request) ? undefined : new Response('no', { status: 400 }),
         websocket: {
            open: socket => {
               this.connections++
               this.sockets.add(socket)
            },
            message: (_, message) => {
               this.received.push(JSON.parse(String(message)))
            },
            close: socket => {
               this.sockets.delete(socket)
            }
         }
      })
   }

   get url(): string {
      return `ws://localhost:${this.server.port}`
   }

   push(message: Pushed): void {
      for (const socket of this.sockets) socket.send(JSON.stringify(message))
   }

   drop(): void {
      for (const socket of this.sockets) socket.close()
   }
}

const protocolFor = (feed: FakeFeed, idleMs?: number): SocketProtocol<string> => ({
   name: 'fake',
   url: feed.url,
   idleMs,
   opening: async () => [{ hello: true }],
   subscribe: keys => [{ subscribe: keys }],
   unsubscribe: keys => [{ unsubscribe: keys }],
   read: message => {
      const { key, price, refused } = message as Pushed
      return (refused ? [{ key, live: false }] : [{ key, value: price! }]) as Inbound<string>[]
   }
})

class Recorder implements StreamListener<string> {
   readonly events: string[] = []
   readonly lives: boolean[] = []
   onEvent(value: string) { this.events.push(value) }
   onLive(live: boolean) { this.lives.push(live) }
}

async function until(condition: () => boolean): Promise<void> {
   const deadline = Date.now() + 2000
   while (!condition()) {
      if (Date.now() > deadline) throw new Error('Timed out waiting for the socket.')
      await new Promise(resolve => setTimeout(resolve, 5))
   }
}

const feeds: FakeFeed[] = []
const newFeed = () => {
   const feed = new FakeFeed()
   feeds.push(feed)
   return feed
}

afterEach(() => {
   for (const feed of feeds.splice(0)) feed.server.stop(true)
})

describe('a socket hub', () => {

   test('connects on the first watch, greets, subscribes, and is live from the first value', async () => {
      const feed = newFeed()
      const hub = new SocketHub(protocolFor(feed))
      const recorder = new Recorder()

      const subscription = hub.watch('BTC', recorder)
      await until(() => feed.received.length === 2)
      feed.push({ key: 'BTC', price: '100' })
      await until(() => recorder.events.length === 1)

      expect(feed.received).toEqual([{ hello: true }, { subscribe: ['BTC'] }])
      expect(recorder).toMatchObject({ events: ['100'], lives: [true] })
      expect(subscription.live).toBe(true)
      subscription.close()
   })

   test('shares one socket between keys, and closes it once nobody watches', async () => {
      const feed = newFeed()
      const hub = new SocketHub(protocolFor(feed))

      const btc = hub.watch('BTC', new Recorder())
      await until(() => feed.received.length === 2)
      const eth = hub.watch('ETH', new Recorder())
      await until(() => feed.received.length === 3)
      btc.close()
      await until(() => feed.received.length === 4)
      eth.close()
      await until(() => feed.sockets.size === 0)

      expect(feed.connections).toBe(1)
      expect(feed.received.slice(2)).toEqual([{ subscribe: ['ETH'] }, { unsubscribe: ['BTC'] }])
      expect(hub.connected).toBe(false)
   })

   test('tells its listeners when the socket drops, then connects again and subscribes to every key', async () => {
      const feed = newFeed()
      const hub = new SocketHub(protocolFor(feed), { firstRetryMs: 10 })
      const recorder = new Recorder()
      const subscription = hub.watch('BTC', recorder)
      await until(() => feed.received.length === 2)
      feed.push({ key: 'BTC', price: '100' })
      await until(() => subscription.live)

      feed.drop()
      await until(() => !subscription.live)
      await until(() => feed.received.length === 4)
      feed.push({ key: 'BTC', price: '101' })
      await until(() => subscription.live)

      expect(feed.connections).toBe(2)
      expect(feed.received.slice(2)).toEqual([{ hello: true }, { subscribe: ['BTC'] }])
      expect(recorder).toMatchObject({ events: ['100', '101'], lives: [true, false, true] })
      subscription.close()
   })

   test('takes a socket that goes quiet for longer than the protocol allows as dropped', async () => {
      const feed = newFeed()
      const hub = new SocketHub(protocolFor(feed, 50), { firstRetryMs: 10 })
      const subscription = hub.watch('BTC', new Recorder())
      await until(() => feed.received.length === 2)
      feed.push({ key: 'BTC', price: '100' })
      await until(() => subscription.live)

      await until(() => feed.connections === 2)

      expect(subscription.live).toBe(false)
      subscription.close()
   })

   test('marks a key the exchange refused as not live, and tells a late listener of a live one at once', async () => {
      const feed = newFeed()
      const hub = new SocketHub(protocolFor(feed))
      const first = hub.watch('BTC', new Recorder())
      const refused = hub.watch('FOO', new Recorder())
      await until(() => feed.received.length === 2)
      feed.push({ key: 'BTC', price: '100' })
      feed.push({ key: 'FOO', refused: true })
      await until(() => first.live)

      const late = new Recorder()
      const second = hub.watch('BTC', late)
      await until(() => late.lives.length === 1)

      expect(refused.live).toBe(false)
      expect(second.live).toBe(true)
      for (const subscription of [first, refused, second]) subscription.close()
   })
})
