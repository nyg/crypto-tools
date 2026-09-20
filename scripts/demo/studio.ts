import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { chromium } from 'playwright-core'
import type { Browser, CDPSession, Locator, Page } from 'playwright-core'

export interface Segment {
   id: string
   say: string
   caption: string
   duration: number
}

export interface Box {
   x: number
   y: number
   width: number
   height: number
}

export interface Capture {
   t0: number
   end: number
   frames: { file: string, ts: number }[]
   spoken: { id: string, start: number, end: number }[]
   clicks: number[]
}

interface ScreencastFrame {
   data: string
   sessionId: number
   metadata: { timestamp?: number }
}

export interface StudioOptions {
   url: string
   width: number
   height: number
   scale: number
   workDir: string
   segments: Segment[]
   chromePath?: string
}

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const ease = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

const overlayScript = () => {
   const install = () => {
      if (document.getElementById('__cursor')) return
      const style = document.createElement('style')
      style.textContent = `
         ::-webkit-scrollbar { display: none !important }
         html, * { scrollbar-width: none !important }
         #__cursor { position: fixed; left: 0; top: 0; width: 22px; height: 22px; z-index: 2147483647; pointer-events: none; transform: translate(-60px, -60px); transition: opacity 300ms ease; }
         #__cursor svg { width: 22px; height: 22px; filter: drop-shadow(0 1.5px 2px rgba(0,0,0,.35)); transition: transform 120ms ease-out; transform-origin: 3px 2px; }
         #__cursor.down svg { transform: scale(.86); }
         .__ripple { position: fixed; z-index: 2147483646; pointer-events: none; width: 40px; height: 40px; margin: -20px 0 0 -20px; border-radius: 50%; background: rgba(37, 99, 235, .28); border: 2px solid rgba(37, 99, 235, .55); animation: __ripple 520ms ease-out forwards; }
         @keyframes __ripple { from { transform: scale(.25); opacity: 1 } to { transform: scale(1.35); opacity: 0 } }
         #__spot { position: fixed; z-index: 2147483645; pointer-events: none; border-radius: 10px; box-shadow: 0 0 0 3px rgba(37, 99, 235, .85), 0 0 0 9999px rgba(15, 23, 42, .18); opacity: 0; transition: opacity 350ms ease, left 450ms ease, top 450ms ease, width 450ms ease, height 450ms ease; }
         #__spot.on { opacity: 1; }
         #__card { position: fixed; inset: 0; z-index: 2147483640; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: radial-gradient(ellipse at 50% 35%, #ffffff 0%, #f1f5f9 70%, #e2e8f0 100%); opacity: 0; pointer-events: none; transition: opacity 600ms ease; font-family: inherit; color: #0f172a; }
         #__card.on { opacity: 1; }
         html:has(#__card.on) #__cursor { opacity: 0; }
         #__card .kicker { font-size: 15px; letter-spacing: .18em; text-transform: uppercase; color: #64748b; font-weight: 500; }
         #__card .title { font-size: 52px; font-weight: 650; letter-spacing: -.02em; }
         #__card .sub { font-size: 20px; color: #475569; }
         #__card .note { position: absolute; bottom: 34px; font-size: 13px; color: #94a3b8; }
      `
      document.documentElement.appendChild(style)

      const cursor = document.createElement('div')
      cursor.id = '__cursor'
      cursor.innerHTML = '<svg viewBox="0 0 22 22"><path d="M3 2 L3 18.5 L7.2 14.6 L10.1 20.8 L13 19.5 L10.2 13.5 L16 13.3 Z" fill="#0f172a" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>'
      document.documentElement.appendChild(cursor)

      const spot = document.createElement('div')
      spot.id = '__spot'
      document.documentElement.appendChild(spot)

      const card = document.createElement('div')
      card.id = '__card'
      document.documentElement.appendChild(card)

      window.addEventListener('mousemove', event => {
         cursor.style.transform = `translate(${event.clientX - 3}px, ${event.clientY - 2}px)`
      }, true)

      window.addEventListener('mousedown', event => {
         cursor.classList.add('down')
         const ripple = document.createElement('div')
         ripple.className = '__ripple'
         ripple.style.left = `${event.clientX}px`
         ripple.style.top = `${event.clientY}px`
         document.documentElement.appendChild(ripple)
         setTimeout(() => ripple.remove(), 600)
      }, true)

      window.addEventListener('mouseup', () => cursor.classList.remove('down'), true)
   }

   if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install)
   else install()
}

export class Studio {

   page!: Page

   #options: StudioOptions
   #browser!: Browser
   #cdp!: CDPSession
   #segments: Map<string, Segment>
   #frames: { file: string, ts: number }[] = []
   #spoken: { id: string, start: number, end: number }[] = []
   #clicks: number[] = []
   #speaking: Promise<void> = Promise.resolve()
   #writes: Promise<unknown>[] = []
   #mouse = { x: 640, y: 420 }
   #t0 = 0

   constructor(options: StudioOptions) {
      this.#options = options
      this.#segments = new Map(options.segments.map(segment => [segment.id, segment]))
   }

   get frameDir() {
      return `${this.#options.workDir}/frames`
   }

   get baseUrl() {
      return this.#options.url.replace(/\/$/, '')
   }

   async open() {
      const { url, width, height, scale, chromePath } = this.#options
      this.#browser = await chromium.launch({
         executablePath: chromePath ?? CHROME,
         args: ['--lang=en-US', '--hide-scrollbars', '--force-color-profile=srgb']
      })
      const context = await this.#browser.newContext({
         viewport: { width, height },
         deviceScaleFactor: scale,
         locale: 'en-US',
         colorScheme: 'light'
      })
      await context.addInitScript(overlayScript)
      this.page = await context.newPage()
      this.page.on('pageerror', error => console.error('page error', error))
      await this.page.goto(url)
      await this.page.evaluate(overlayScript)
   }

   async close() {
      await this.#browser.close()
   }

   async startCapture() {
      const { width, height, scale } = this.#options
      rmSync(this.frameDir, { recursive: true, force: true })
      mkdirSync(this.frameDir, { recursive: true })
      this.#cdp = await this.page.context().newCDPSession(this.page)

      let index = 0
      this.#cdp.on('Page.screencastFrame', (frame: ScreencastFrame) => {
         const file = `${this.frameDir}/${String(index++).padStart(6, '0')}.jpg`
         this.#frames.push({ file, ts: frame.metadata.timestamp ?? Date.now() / 1000 })
         this.#writes.push(Bun.write(file, Buffer.from(frame.data, 'base64')))
         this.#cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {})
      })

      await this.#cdp.send('Page.startScreencast', {
         format: 'jpeg',
         quality: 93,
         maxWidth: width * scale,
         maxHeight: height * scale,
         everyNthFrame: 1
      })
   }

   async stopCapture(file: string) {
      const end = this.now()
      await this.#cdp.send('Page.stopScreencast')
      await Promise.all(this.#writes)
      const capture: Capture = { t0: this.#t0, end, frames: this.#frames, spoken: this.#spoken, clicks: this.#clicks }
      writeFileSync(file, JSON.stringify(capture, null, 1))
      console.log(`captured ${this.#frames.length} frames over ${(end - this.#t0).toFixed(1)} s`)
   }

   now() {
      return Date.now() / 1000
   }

   markStart() {
      this.#t0 = this.now()
   }

   speak(id: string, gap = 0.35): Promise<void> {
      const segment = this.#segments.get(id)
      if (!segment) throw new Error(`no narration segment named ${id}`)
      const previous = this.#speaking
      this.#speaking = (async () => {
         await previous
         const start = this.now()
         this.#spoken.push({ id, start, end: start + segment.duration })
         console.log(`  ${id} at ${(start - this.#t0).toFixed(1)} s`)
         await sleep((segment.duration + gap) * 1000)
      })()
      return this.#speaking
   }

   async quiet() {
      await this.#speaking
   }

   async pause(ms: number) {
      await sleep(ms)
   }

   async moveTo(x: number, y: number, ms = 650) {
      const from = { ...this.#mouse }
      const distance = Math.hypot(x - from.x, y - from.y)
      const duration = Math.max(180, Math.min(ms, 250 + distance * 0.9))
      const steps = Math.max(8, Math.round(duration / 14))
      for (let step = 1; step <= steps; step++) {
         const t = ease(step / steps)
         await this.page.mouse.move(from.x + (x - from.x) * t, from.y + (y - from.y) * t)
         await sleep(duration / steps)
      }
      this.#mouse = { x, y }
   }

   async reveal(target: Locator, margin = 40): Promise<Box> {
      await target.waitFor({ state: 'visible' })
      const box = await target.boundingBox()
      if (!box) throw new Error('the element has no box on screen')
      const viewport = this.page.viewportSize()
      if (!viewport) throw new Error('the page has no viewport')
      if (box.y >= margin && box.y + box.height <= viewport.height - margin) return box

      const scrollY = await this.page.evaluate(() => window.scrollY)
      const top = box.height > viewport.height - 2 * margin
         ? scrollY + box.y - margin
         : scrollY + box.y + box.height / 2 - viewport.height / 2
      await this.scrollTo(Math.max(0, top))

      const moved = await target.boundingBox()
      if (!moved) throw new Error('the element left the screen while scrolling')
      return moved
   }

   async hover(target: Locator, offset?: { x?: number, y?: number }, ms?: number) {
      const box = await this.reveal(target)
      await this.moveTo(box.x + (offset?.x ?? box.width / 2), box.y + (offset?.y ?? box.height / 2), ms)
   }

   async click(target: Locator, options?: { offset?: { x?: number, y?: number }, settle?: number, ms?: number }) {
      await this.hover(target, options?.offset, options?.ms)
      await sleep(140)
      this.#clicks.push(this.now())
      await this.page.mouse.down()
      await sleep(90)
      await this.page.mouse.up()
      await sleep(options?.settle ?? 350)
   }

   async type(text: string, delay = 65) {
      for (const character of text) {
         await this.page.keyboard.type(character)
         await sleep(delay + Math.random() * 35)
      }
   }

   async replace(target: Locator, text: string) {
      await this.click(target, { settle: 100, ms: 420 })
      await this.page.keyboard.press('ControlOrMeta+a')
      await sleep(80)
      await this.type(text, 55)
   }

   async spot(target: Locator | Box | null, pad = 6) {
      if (!target) {
         await this.page.evaluate(() => document.getElementById('__spot')?.classList.remove('on'))
         return
      }
      const box = 'boundingBox' in target ? await this.reveal(target) : target
      await this.page.evaluate(({ x, y, width, height, pad }) => {
         const spot = document.getElementById('__spot')
         if (!spot) return
         spot.style.left = `${x - pad}px`
         spot.style.top = `${y - pad}px`
         spot.style.width = `${width + 2 * pad}px`
         spot.style.height = `${height + 2 * pad}px`
         spot.classList.add('on')
      }, { ...box, pad })
   }

   async spotColumn(table: Locator, from: string, to = from, pad = 4) {
      await this.reveal(table)
      const box = await table.evaluate((element, [from, to]: string[]) => {
         const headers = [...element.querySelectorAll('th')]
         const first = headers.find(header => header.textContent?.trim() === from)
         const last = headers.find(header => header.textContent?.trim() === to)
         if (!first || !last) throw new Error(`no column headed ${from} or ${to}`)
         const whole = element.getBoundingClientRect()
         const left = first.getBoundingClientRect()
         const right = last.getBoundingClientRect()
         return { x: left.left, y: whole.top, width: right.right - left.left, height: whole.height }
      }, [from, to])
      await this.spot(box, pad)
   }

   async card(html: string | null) {
      await this.page.evaluate(html => {
         const card = document.getElementById('__card')
         if (!card) return
         if (html === null) card.classList.remove('on')
         else {
            card.innerHTML = html
            card.classList.add('on')
         }
      }, html)
      await sleep(650)
   }

   async scrollTo(top: number, ms = 900) {
      await this.page.evaluate(({ top, ms }) => new Promise<void>(resolve => {
         const from = window.scrollY
         const start = performance.now()
         const step = (now: number) => {
            const t = Math.min(1, (now - start) / ms)
            const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
            window.scrollTo(0, from + (top - from) * eased)
            if (t < 1) requestAnimationFrame(step)
            else resolve()
         }
         requestAnimationFrame(step)
      }), { top, ms })
   }
}
