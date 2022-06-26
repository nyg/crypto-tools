import '../styles/global.css'
import { SWRConfig } from 'swr'


function MyApp({ Component, pageProps }) {
   return (
      <SWRConfig value={{ fetcher: (url) => fetch(url).then(res => res.json()) }}>
         <Component {...pageProps} />
      </SWRConfig>
   )
}

export default MyApp
