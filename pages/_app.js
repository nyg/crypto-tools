import { SWRConfig } from 'swr'
import '../styles/global.css'

const isMockMode = process.env.NEXT_PUBLIC_MOCK_DATA === 'true'

if (isMockMode) {
   import('@/lib/mocks').then(({ initMockCredentials }) => initMockCredentials())
}

async function fetcher(url, params) {

   if (isMockMode) {
      const { mockFetcher } = await import('@/lib/mocks')
      return mockFetcher(url, params)
   }

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

export default function MyApp({ Component, pageProps }) {
   return (
      <SWRConfig value={{ fetcher }}>
         <Component {...pageProps} />
      </SWRConfig>
   )
}
