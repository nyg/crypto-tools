const injectedLocales = typeof window !== 'undefined' && Array.isArray(window.__LOCALES__)
   ? window.__LOCALES__
   : []

const navigatorLocales = typeof navigator === 'undefined'
   ? []
   : navigator.languages?.length
      ? [...navigator.languages]
      : navigator.language ? [navigator.language] : []

export const locales = injectedLocales.length ? injectedLocales
   : navigatorLocales.length ? navigatorLocales
      : ['en-US']
