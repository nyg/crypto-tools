import { SWRConfig } from 'swr'
import { LocaleContext } from '../contexts/locale-context'
import '../styles/global.css'


async function fetcher(url, params) {

   let response
   if (params?.arg) {
      response = await fetch(url, {
         method: 'POST',
         body: JSON.stringify(params.arg),
         headers: { 'Content-Type': 'application/json' }
      })
   }
   else {
      response = await fetch(url)
   }

   const result = await response.json()
   if (!response.ok) {
      const error = result?.error || 'An unexpected error happened.'
      return Promise.reject(error)
   }

   return result
}

function parseLocale(acceptLanguage) {
   if (!acceptLanguage) return 'en-GB'
   const primary = acceptLanguage.split(',')[0].trim().split(';')[0].trim()
   return primary || 'en-GB'
}

export default function MyApp({ Component, pageProps, locale }) {
   return (
      <LocaleContext.Provider value={locale}>
         <SWRConfig value={{ fetcher }}>
            <Component {...pageProps} />
         </SWRConfig>
      </LocaleContext.Provider>
   )
}

MyApp.getInitialProps = async ({ ctx }) => {
   // Server-side: read from the Accept-Language request header.
   // Client-side (navigating between pages): ctx.req is undefined, fall back to navigator.language.
   const acceptLanguage = ctx.req
      ? ctx.req.headers['accept-language']
      : (typeof navigator !== 'undefined' ? navigator.language : null)
   return { locale: parseLocale(acceptLanguage) }
}
