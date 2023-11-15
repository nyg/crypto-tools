import Head from 'next/head'
import Menu from '../components/menu'


export default function Kraken() {
   return (
      <div>
         <Head>
            <title>Crypto Tools — Kraken</title>
            <meta name="description" content="Crypto Tools" />
            <link rel="icon" href="/favicon.ico" />
         </Head>

         <main className="flex flex-col px-12 pb-12">
            <header className="px-3 pb-2 my-4 flex items-baseline gap-x-3 border-b">
               <h1 className="text-xl">Crypto Tools</h1>
               <span className="flex-grow"></span>
               <Menu />
            </header>

            <section className="flex-grow text-sm space-y-6 tabular-nums">
               <div className="px-3 space-y-4">
                  <p>Kraken!</p>
               </div>
            </section>
         </main>
      </div>
   )
}
