/// <reference types="bun-types" />
import { ApplicationMenu, BrowserWindow, Utils, app } from 'electrobun/bun'
import { createApp } from '../server/app.js'
import { systemLocales } from './locale'
import { resolveInitialWindowState, trackWindowState } from './window-state'

const DEV_API_PORT = Number(process.env.PORT ?? 3001)
const DEV_SERVER_URL = `http://localhost:${process.env.VITE_PORT ?? 3000}`
const VIEWS_URL = 'views://main/index.html'

async function resolveUrl(): Promise<string> {
   if (app.channel !== 'dev') {
      return VIEWS_URL
   }
   try {
      await fetch(`${DEV_SERVER_URL}/`, { signal: AbortSignal.timeout(1000) })
      return DEV_SERVER_URL
   } catch {
      return VIEWS_URL
   }
}

async function main() {
   const url = await resolveUrl()

   const honoApp = createApp()

   // The dev server proxies /api to a fixed port; a packaged app takes whatever port
   // the OS hands out, so two Electrobun apps never fight over the same one.
   const usingDevServer = url === DEV_SERVER_URL
   let server: ReturnType<typeof Bun.serve>
   try {
      server = Bun.serve({
         port: usingDevServer ? DEV_API_PORT : 0,
         hostname: '127.0.0.1',
         fetch: honoApp.fetch,
         idleTimeout: 0,
      })
      console.log(`✓ API server listening on http://127.0.0.1:${server.port}`)
   }
   catch (error: any) {
      if (error?.code !== 'EADDRINUSE') throw error
      console.error(`✗ Port ${DEV_API_PORT} is already in use — another instance is running.`)
      console.error('  Start this one on its own ports: PORT=3011 VITE_PORT=3010 bun run desktop:dev')
      process.exit(1)
   }

   const locales = systemLocales()
   const preload = [
      `window.__API_PORT__ = ${server.port};`,
      locales.length ? `window.__LOCALES__ = ${JSON.stringify(locales)};` : null,
   ].filter(Boolean).join(' ')

   // Created hidden so the geometry is applied before the window is ever drawn; the frame
   // is the restored (un-maximized) size, the maximized rectangle is left to the OS.
   const initialWindowState = resolveInitialWindowState()
   const win = new BrowserWindow({
      title: 'Crypto Tools',
      url,
      preload,
      frame: initialWindowState.frame,
      hidden: true,
   });

   // Open target="_blank" links in the default system browser instead of the WebView.
   (win.webview as any).on('new-window-open', (event: any) => {
      const detail = event?.data?.detail
      const href: string | undefined = typeof detail === 'string' ? detail : detail?.url
      if (href) {
         Utils.openExternal(href)
      }
   })

   trackWindowState(win, initialWindowState)

   try {
      if (initialWindowState.maximized && !win.isMaximized()) {
         win.maximize()
      }
   }
   catch (error) {
      console.error('✗ Could not restore the maximized window state:', error)
   }

   win.show()

   ApplicationMenu.setApplicationMenu([
      {
         label: 'Crypto Tools',
         submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'showAll' },
            { type: 'separator' },
            { role: 'quit', accelerator: 'CommandOrControl+Q' },
         ],
      },
      {
         label: 'Edit',
         submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { role: 'selectAll' },
         ],
      },
      {
         label: 'Window',
         submenu: [
            { role: 'close', accelerator: 'CommandOrControl+W' },
            { role: 'minimize' },
            { role: 'zoom' },
            { type: 'separator' },
            { role: 'bringAllToFront' },
         ],
      },
   ])
}

main()
