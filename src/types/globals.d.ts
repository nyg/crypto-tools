// Injected into the page by the Electrobun main process preload, see src/electrobun/index.ts.
// Absent in the browser, where the API is same-origin and the locales come from navigator.
declare global {
   interface Window {
      __API_PORT__?: number
      __LOCALES__?: string[]
   }
}

export {}
