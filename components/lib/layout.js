import Head from 'next/head'
import Menu from '../menu'


export default function Layout({ children, name }) {
   return (
      <>
         <Head>
            <title>{`Crypto Tools — ${name}`}</title>
            <meta name="description" content="Crypto Tools" />
            <link rel="icon" href="/favicon.ico" />
         </Head>

         <main className="flex flex-col px-12 pb-12">
            <header className="px-3 pb-2 my-4 flex items-baseline gap-x-3 border-b">
               <h1 className="text-xl">Crypto Tools</h1>
               <span className="flex-grow"></span>
               <Menu />
            </header>

            {children}
         </main>
      </>
   )
}
