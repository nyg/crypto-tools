import { mkdirSync } from 'fs'
import { relative, resolve } from 'path'
import { chromium } from 'playwright-core'
import type { Browser, Page } from 'playwright-core'
import { shots } from './shots'
import type { Shot } from './shots'

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const WIDTH = 1440
const HEIGHT = 900
const FRAME_WIDTH = 2247
const MARGIN = 44
const RADIUS = 14
const QUIET = 1200
const SETTLE_TIMEOUT = 30000

const args = process.argv.slice(2)
const option = (name: string) => args.find(argument => argument.startsWith(`--${name}=`))?.split('=').slice(1).join('=')
const names = args.filter(argument => !argument.startsWith('--'))
const root = resolve(import.meta.dir, '../..')
const out = resolve(option('out') ?? `${root}/public`)
const port = Number(option('port') ?? 3100)

if (args.includes('--list')) {
   shots.forEach(({ name, path }) => console.log(`${name.padEnd(28)} ${path}`))
   process.exit(0)
}

const unknown = names.filter(name => !shots.some(shot => shot.name === name))
if (unknown.length > 0) {
   console.error(`unknown screenshot: ${unknown.join(', ')} (see --list)`)
   process.exit(1)
}

const selected = names.length > 0 ? shots.filter(shot => names.includes(shot.name)) : shots
mkdirSync(out, { recursive: true })

const server = Bun.spawn(['./node_modules/.bin/vite', '--port', String(port), '--strictPort'], {
   cwd: root,
   env: { ...process.env, VITE_MOCK_DATA: 'true' },
   stdout: 'ignore',
   stderr: 'inherit'
})

let browser: Browser | undefined

try {
   await waitForServer(port)
   browser = await chromium.launch({
      executablePath: CHROME,
      args: ['--lang=en-US', '--hide-scrollbars', '--force-color-profile=srgb']
   })
   const framer = await browser.newPage()

   for (const shot of selected) {
      const capture = await captureShot(browser, shot)
      const framed = await frame(framer, capture)
      const file = `${out}/screenshot-${shot.name}.png`
      await Bun.write(file, framed)
      console.log(`${shot.name.padEnd(28)} ${relative(process.cwd(), file)}`)
   }
}
finally {
   await browser?.close()
   server.kill()
}

async function captureShot(browser: Browser, shot: Shot): Promise<Buffer> {

   const context = await browser.newContext({
      viewport: { width: shot.width ?? WIDTH, height: HEIGHT },
      deviceScaleFactor: 2,
      locale: 'en-US',
      colorScheme: 'light',
      reducedMotion: 'reduce'
   })

   const leaks: string[] = []
   await context.route(url => url.pathname.startsWith('/api/'), route => {
      leaks.push(route.request().url())
      return route.abort()
   })
   await context.addInitScript(storage => {
      localStorage.clear()
      Object.entries(storage).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
   }, shot.storage ?? {})

   try {
      const page = await context.newPage()
      page.on('pageerror', error => console.error(`${shot.name}: page error`, error))
      await page.goto(`http://localhost:${port}${shot.path}`)
      await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important }' })
      await waitForQuiet(page, shot)
      if (shot.prepare) {
         await shot.prepare(page)
         await waitForQuiet(page, shot)
      }
      await page.evaluate(() => document.fonts.ready)

      if (leaks.length > 0) throw new Error(`${shot.name} reached a real API, so the server is not mocked: ${leaks.join(', ')}`)
      return await page.screenshot({ fullPage: true, scale: 'device' })
   }
   finally {
      await context.close()
   }
}

async function waitForQuiet(page: Page, shot: Shot) {
   const deadline = Date.now() + SETTLE_TIMEOUT
   let quietSince = 0
   while (Date.now() < deadline) {
      const busy = await page.evaluate(() => !document.querySelector('main')?.textContent?.trim() || document.querySelector('.animate-spin') !== null)
      if (busy) quietSince = 0
      else if (quietSince === 0) quietSince = Date.now()
      else if (Date.now() - quietSince >= QUIET) return
      await page.waitForTimeout(100)
   }
   throw new Error(`${shot.name} was still loading after ${SETTLE_TIMEOUT / 1000} s`)
}

async function frame(page: Page, capture: Buffer): Promise<Buffer> {
   const dataUrl = await page.evaluate(async ({ png, width, margin, radius }) => {
      const image = new Image()
      image.src = `data:image/png;base64,${png}`
      await image.decode()

      const inner = width - 2 * margin
      const height = Math.round(image.height * inner / image.width)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height + 2 * margin

      const context = canvas.getContext('2d')
      if (!context) throw new Error('no 2d context')
      context.imageSmoothingQuality = 'high'
      context.beginPath()
      context.roundRect(margin, margin, inner, height, radius)

      context.save()
      context.shadowColor = 'rgba(15, 23, 42, 0.28)'
      context.shadowBlur = 40
      context.shadowOffsetY = 14
      context.fillStyle = '#ffffff'
      context.fill()
      context.restore()

      context.clip()
      context.drawImage(image, margin, margin, inner, height)
      return canvas.toDataURL('image/png')
   }, { png: capture.toString('base64'), width: FRAME_WIDTH, margin: MARGIN, radius: RADIUS })

   return Buffer.from(dataUrl.split(',')[1] ?? '', 'base64')
}

async function waitForServer(port: number) {
   for (let attempt = 0; attempt < 60; attempt++) {
      if (server.exitCode !== null) throw new Error(`vite exited with code ${server.exitCode}: is port ${port} already taken?`)
      try {
         await fetch(`http://localhost:${port}/`)
         return
      }
      catch {
         await Bun.sleep(500)
      }
   }
   throw new Error(`vite did not start on port ${port}`)
}
