import { messageOf } from '../../errors'

export const ORDERS = 'orders'

export interface StreamListener<T> {
   onEvent(value: T): void
   onLive(live: boolean): void
}

export interface StreamSubscription {
   readonly live: boolean
   close(): void
}

export type Inbound<T> = { key: string, value: T } | { key: string, live: boolean }

export interface SocketProtocol<T> {
   readonly name: string
   readonly url: string
   readonly idleMs?: number
   readonly ping?: { everyMs: number, message: unknown }
   opening?(): Promise<unknown[]>
   subscribe(keys: string[]): unknown[] | Promise<unknown[]>
   unsubscribe(keys: string[]): unknown[]
   read(message: unknown): Inbound<T>[]
}

export interface HubOptions {
   firstRetryMs?: number
   maxRetryMs?: number
   open?: (url: string) => WebSocket
}

interface Topic<T> {
   listeners: Set<StreamListener<T>>
   live: boolean
}

type Timer = ReturnType<typeof setTimeout>

const notify = (work: () => void) => {
   try {
      work()
   }
   catch (error) {
      console.warn('A stream listener failed:', messageOf(error))
   }
}

export default class SocketHub<T> {

   readonly #protocol: SocketProtocol<T>
   readonly #firstRetryMs: number
   readonly #maxRetryMs: number
   readonly #open: (url: string) => WebSocket
   readonly #topics = new Map<string, Topic<T>>()
   #socket: WebSocket | null = null
   #ready = false
   #retryMs: number
   #retry: Timer | null = null
   #idle: Timer | null = null
   #ping: ReturnType<typeof setInterval> | null = null

   constructor(protocol: SocketProtocol<T>, { firstRetryMs = 1000, maxRetryMs = 30000, open = url => new WebSocket(url) }: HubOptions = {}) {
      this.#protocol = protocol
      this.#firstRetryMs = firstRetryMs
      this.#maxRetryMs = maxRetryMs
      this.#open = open
      this.#retryMs = firstRetryMs
   }

   get connected(): boolean {
      return this.#socket !== null
   }

   watch(key: string, listener: StreamListener<T>): StreamSubscription {

      let topic = this.#topics.get(key)
      if (!topic) {
         topic = { listeners: new Set(), live: false }
         this.#topics.set(key, topic)
         if (this.#ready) this.#subscribe(this.#socket!, [key])
      }
      topic.listeners.add(listener)
      if (topic.live) queueMicrotask(() => topic.live && topic.listeners.has(listener) && notify(() => listener.onLive(true)))
      this.#connect()

      let closed = false
      const watched = topic
      return {
         get live() {
            return !closed && watched.live
         },
         close: () => {
            if (closed) return
            closed = true
            this.#leave(key, listener)
         }
      }
   }

   #leave(key: string, listener: StreamListener<T>): void {
      const topic = this.#topics.get(key)
      if (!topic?.listeners.delete(listener) || topic.listeners.size > 0) return
      this.#topics.delete(key)
      if (this.#topics.size === 0) return this.#shutdown()
      if (this.#ready) this.#send(this.#socket!, this.#protocol.unsubscribe([key]))
   }

   #connect(): void {
      if (this.#socket || this.#retry || this.#topics.size === 0) return

      let socket: WebSocket
      try {
         socket = this.#open(this.#protocol.url)
      }
      catch (error) {
         console.warn(`Could not open the ${this.#protocol.name} socket:`, messageOf(error))
         return this.#scheduleRetry()
      }

      this.#socket = socket
      socket.addEventListener('open', () => void this.#greet(socket))
      socket.addEventListener('message', event => this.#receive(socket, event.data))
      socket.addEventListener('close', () => this.#dropped(socket))
      socket.addEventListener('error', () => this.#dropped(socket))
   }

   async #greet(socket: WebSocket): Promise<void> {
      try {
         this.#send(socket, await this.#protocol.opening?.() ?? [])
         if (this.#socket !== socket) return
         this.#ready = true
         this.#awake(socket)
         const { ping } = this.#protocol
         if (ping) this.#ping = setInterval(() => this.#send(socket, [ping.message]), ping.everyMs)
         this.#subscribe(socket, [...this.#topics.keys()])
      }
      catch (error) {
         console.warn(`Could not start the ${this.#protocol.name} stream:`, messageOf(error))
         this.#dropped(socket)
      }
   }

   #subscribe(socket: WebSocket, keys: string[]): void {
      if (keys.length === 0) return
      Promise.resolve(this.#protocol.subscribe(keys))
         .then(messages => this.#send(socket, messages))
         .catch(error => {
            console.warn(`Could not subscribe to the ${this.#protocol.name} stream:`, messageOf(error))
            this.#dropped(socket)
         })
   }

   #send(socket: WebSocket, messages: unknown[]): void {
      if (this.#socket !== socket || socket.readyState !== WebSocket.OPEN) return
      for (const message of messages) socket.send(JSON.stringify(message))
   }

   #receive(socket: WebSocket, data: unknown): void {
      if (this.#socket !== socket) return
      this.#awake(socket)

      let message: unknown
      try {
         message = JSON.parse(String(data))
      }
      catch {
         return
      }

      for (const inbound of this.#protocol.read(message)) {
         const topic = this.#topics.get(inbound.key)
         if (!topic) continue
         if ('value' in inbound) {
            this.#setLive(topic, true)
            for (const listener of [...topic.listeners]) notify(() => listener.onEvent(inbound.value))
         }
         else this.#setLive(topic, inbound.live)
      }
   }

   #setLive(topic: Topic<T>, live: boolean): void {
      if (topic.live === live) return
      topic.live = live
      if (live) this.#retryMs = this.#firstRetryMs
      for (const listener of [...topic.listeners]) notify(() => listener.onLive(live))
   }

   // A socket nobody answers on any more can stay open for minutes before it closes:
   // where the exchange speaks at a steady pace, silence is taken as a drop.
   #awake(socket: WebSocket): void {
      const { idleMs } = this.#protocol
      if (!idleMs) return
      if (this.#idle) clearTimeout(this.#idle)
      this.#idle = setTimeout(() => this.#dropped(socket), idleMs)
   }

   #dropped(socket: WebSocket): void {
      if (this.#socket !== socket) return
      this.#reset()
      try {
         socket.close()
      }
      catch { /* already closed */ }
      for (const topic of this.#topics.values()) this.#setLive(topic, false)
      if (this.#topics.size > 0) this.#scheduleRetry()
   }

   #scheduleRetry(): void {
      const wait = this.#retryMs
      this.#retryMs = Math.min(wait * 2, this.#maxRetryMs)
      this.#retry = setTimeout(() => {
         this.#retry = null
         this.#connect()
      }, wait)
   }

   #shutdown(): void {
      const socket = this.#socket
      this.#reset()
      if (this.#retry) clearTimeout(this.#retry)
      this.#retry = null
      this.#retryMs = this.#firstRetryMs
      try {
         socket?.close()
      }
      catch { /* already closed */ }
   }

   #reset(): void {
      this.#socket = null
      this.#ready = false
      if (this.#idle) clearTimeout(this.#idle)
      if (this.#ping) clearInterval(this.#ping)
      this.#idle = null
      this.#ping = null
   }
}

export function sharedHub<T>(hubs: Map<string, SocketHub<T>>, key: string, create: () => SocketHub<T>): SocketHub<T> {
   const known = hubs.get(key)
   if (known) return known
   const hub = create()
   hubs.set(key, hub)
   return hub
}
