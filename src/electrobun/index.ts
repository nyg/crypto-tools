/// <reference types="bun-types" />
import { ApplicationMenu, BrowserWindow, BuildConfig, Utils } from 'electrobun/main'
import { createApp } from '../server/app'
import { migrateDevelopmentData } from '../server/data-migration'
import { useProductionData } from '../server/environment'
import { migrateSecretsToCredentialStore } from '../server/secrets'
import { systemLocales } from './locale'
import { handleTitleBarDoubleClick, trackFullScreen } from './title-bar'
import { resolveInitialWindowState, trackWindowState } from './window-state'

const VIEWS_URL = 'views://main/index.html'
const ABOUT_ACTION = 'show-about'
const SHOW_ABOUT_JS = 'window.dispatchEvent(new CustomEvent(\'crypto-tools:show-about\'))'
const hasApplicationMenu = process.platform !== 'win32'
const hasInsetTitleBar = process.platform === 'darwin'
const TRAFFIC_LIGHTS = { x: 20, y: 20 }

type NewWindowOpenEvent = { data?: { detail?: string | { url?: string } } }

type NewWindowOpenListener = {
   on(name: 'new-window-open', handler: (event: NewWindowOpenEvent) => void): void
}

type MenuClickEvent = { data?: { action?: string } }

async function resolveUrl(): Promise<string> {
   const vitePort = process.env.VITE_PORT
   if (BuildConfig.getSync().channel !== 'dev' || !vitePort) {
      return VIEWS_URL
   }
   const devServerUrl = `http://localhost:${vitePort}`
   try {
      await fetch(`${devServerUrl}/`, { signal: AbortSignal.timeout(1000) })
      return devServerUrl
   } catch {
      return VIEWS_URL
   }
}

async function main() {
   const url = await resolveUrl()

   if (BuildConfig.getSync().channel !== 'dev') {
      useProductionData()
      await migrateDevelopmentData()
   }

   await migrateSecretsToCredentialStore()

   const honoApp = createApp({ desktop: true, devServerOrigin: url === VIEWS_URL ? undefined : new URL(url).origin })

   // Whatever port the OS hands out, so two Electrobun apps never fight over the same one.
   // The page learns it from the preload, even when Vite serves the page.
   const server = Bun.serve({
      port: 0,
      hostname: '127.0.0.1',
      fetch: honoApp.fetch,
      idleTimeout: 0,
   })
   console.log(`✓ API server listening on http://127.0.0.1:${server.port}`)

   const locales = systemLocales()
   const preload = [
      `window.__API_PORT__ = ${server.port};`,
      locales.length ? `window.__LOCALES__ = ${JSON.stringify(locales)};` : null,
      hasInsetTitleBar ? 'window.__INSET_TITLEBAR__ = true;' : null,
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
      titleBarStyle: hasInsetTitleBar ? 'hiddenInset' : 'default',
   })

   if (hasInsetTitleBar) {
      win.setWindowButtonPosition(TRAFFIC_LIGHTS.x, TRAFFIC_LIGHTS.y)
      handleTitleBarDoubleClick(win)
      trackFullScreen(win)
   }

   // Open target="_blank" links in the default system browser instead of the WebView.
   // The runtime emits 'new-window-open', but BrowserView.on's name union in the SDK
   // does not list it, so the listener is registered through a narrowed view of it.
   const newWindowOpener = win.webview as unknown as NewWindowOpenListener

   newWindowOpener.on('new-window-open', (event) => {
      const detail = event?.data?.detail
      const href = typeof detail === 'string' ? detail : detail?.url
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

   if (!hasApplicationMenu) {
      return
   }

   ApplicationMenu.on('application-menu-clicked', (event) => {
      if ((event as MenuClickEvent)?.data?.action !== ABOUT_ACTION) {
         return
      }
      try {
         win.webview.executeJavascript(SHOW_ABOUT_JS)
      }
      catch (error) {
         console.error('✗ Could not open the About dialog:', error)
      }
   })

   ApplicationMenu.setApplicationMenu([
      {
         label: 'Crypto Tools',
         submenu: [
            { label: 'About Crypto Tools', action: ABOUT_ACTION },
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
