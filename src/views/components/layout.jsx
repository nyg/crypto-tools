import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import MenuLink from './lib/menu-link'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import useLatestRelease, { APP_VERSION } from '@/lib/use-latest-release'
import { groupHref } from '@/lib/tools'


const isSection = (path, href) => path.split('/')[1] === href.split('/')[1]

let updateToastShown = false

// Lucide has no brand icons, so the GitHub mark is inlined. The explicit width/height
// matter: without them WKWebView (the Electrobun desktop app) collapses the svg to 0×0.
const GithubLogo = props => (
   <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.04.77 2.1 0 1.52-.01 2.74-.01 3.11 0 .3.2.66.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
   </svg>
)

function useUpdateToast() {

   const navigate = useNavigate()
   const { version, updateAvailable } = useLatestRelease()

   useEffect(() => {
      if (!updateAvailable || updateToastShown) return

      updateToastShown = true
      toast(`Version ${version} is available.`, {
         action: { label: 'Details', onClick: () => navigate('/about') }
      })
   }, [updateAvailable, version])
}

export default function Layout({ children, name }) {

   useUpdateToast()

   useEffect(() => {
      document.title = `Crypto Tools — ${name}`
   }, [name])

   return (
      <div className="flex min-h-svh flex-col">

         <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
            <div className="flex h-14 w-full items-center gap-4 px-4 sm:gap-6 sm:px-6">
               <Link to="/" className="font-heading text-sm font-semibold tracking-tight whitespace-nowrap">
                  Crypto Tools
               </Link>
               <nav className="flex items-center gap-3 sm:gap-4">
                  <MenuLink href={groupHref('Kraken')} isActive={isSection}>Kraken</MenuLink>
                  <MenuLink href={groupHref('Binance')} isActive={isSection}>Binance</MenuLink>
                  <MenuLink href="/settings" isActive={isSection}>Settings</MenuLink>
               </nav>
               <Link to="/about"
                  className="ml-auto text-xs text-muted-foreground tabular-nums hover:text-foreground">
                  {APP_VERSION ? `v${APP_VERSION}` : 'About'}
               </Link>
               <Button asChild variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground">
                  <a href="https://github.com/nyg/crypto-tools" target="_blank" rel="noreferrer">
                     <GithubLogo />
                     <span className="sr-only">GitHub</span>
                  </a>
               </Button>
            </div>
         </header>

         <main className="w-full grow px-4 pt-5 pb-8 sm:px-6">
            {children}
         </main>

         <Toaster />

      </div>
   )
}
