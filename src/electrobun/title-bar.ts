/// <reference types="bun-types" />
import type { BrowserWindow } from 'electrobun/main'

const DOUBLE_CLICK_MESSAGE = 'title-bar-double-click'
const FULL_SCREEN_EVENT = 'crypto-tools:full-screen'

type HostMessageEvent = { data?: { detail?: { type?: string } } }

type HostMessageListener = {
   on(name: 'host-message', handler: (event: HostMessageEvent) => void): void
}

function doubleClickAction(): string {
   const result = Bun.spawnSync(['defaults', 'read', '-g', 'AppleActionOnDoubleClick'])
   return result.success ? result.stdout.toString().trim() : ''
}

function performDoubleClickAction(win: BrowserWindow) {
   if (win.isFullScreen()) {
      return
   }
   switch (doubleClickAction()) {
      case 'None':
         return
      case 'Minimize':
         win.minimize()
         return
      default:
         if (win.isMaximized()) win.unmaximize()
         else win.maximize()
   }
}

export function handleTitleBarDoubleClick(win: BrowserWindow) {
   const hostMessages = win.webview as unknown as HostMessageListener
   hostMessages.on('host-message', (event) => {
      if (event?.data?.detail?.type !== DOUBLE_CLICK_MESSAGE) {
         return
      }
      try {
         performDoubleClickAction(win)
      }
      catch (error) {
         console.error('✗ Could not apply the title bar double-click action:', error)
      }
   })
}

export function trackFullScreen(win: BrowserWindow) {
   let reported: boolean | null = null

   const report = () => {
      try {
         const fullScreen = win.isFullScreen()
         if (fullScreen === reported) {
            return
         }
         reported = fullScreen
         win.webview.executeJavascript(`window.__FULL_SCREEN__ = ${fullScreen}; window.dispatchEvent(new Event('${FULL_SCREEN_EVENT}'))`)
      }
      catch (error) {
         console.error('✗ Could not report the full screen state:', error)
      }
   }

   win.on('resize', report)
   win.webview.on('dom-ready', () => {
      reported = null
      report()
   })
}
