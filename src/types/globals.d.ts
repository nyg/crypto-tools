// Injected into the page by the Electrobun main process and its preload, see src/electrobun/index.ts.
// Absent in the browser, where the API is same-origin and the locales come from navigator.
declare global {
   interface Window {
      __API_PORT__?: number
      __LOCALES__?: string[]
      __INSET_TITLEBAR__?: boolean
      __FULL_SCREEN__?: boolean
      __electrobunSendToHost?: (message: unknown) => void
   }
}

export {}
