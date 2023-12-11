import { SWRConfig } from 'swr'
import '../styles/global.css'


async function fetcher(url, params) {

   const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(params.arg),
      headers: { 'Content-Type': 'application/json' }
   })

   const result = await response.json()
   if (!response.ok) {
      const error = result?.error || 'An unexpected error happened.'
      return Promise.reject(error)
   }

   return result
}

export default function MyApp({ Component, pageProps }) {
   return (
      <SWRConfig value={{ fetcher }}>
         <Component {...pageProps} />
      </SWRConfig>
   )
}
