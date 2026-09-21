import { useSyncExternalStore } from 'react'
import type { MouseEvent } from 'react'

const FULL_SCREEN_EVENT = 'crypto-tools:full-screen'

const NO_DRAG_SELECTOR = '.electrobun-webkit-app-region-no-drag'

const subscribe = (listener: () => void) => {
   window.addEventListener(FULL_SCREEN_EVENT, listener)
   return () => window.removeEventListener(FULL_SCREEN_EVENT, listener)
}

const isFullScreen = () => window.__FULL_SCREEN__ === true

export const useFullScreen = (): boolean => useSyncExternalStore(subscribe, isFullScreen)

export function onTitleBarDoubleClick(event: MouseEvent<HTMLElement>) {
   if (event.target instanceof Element && event.target.closest(NO_DRAG_SELECTOR)) {
      return
   }
   window.__electrobunSendToHost?.({ type: 'title-bar-double-click' })
}
