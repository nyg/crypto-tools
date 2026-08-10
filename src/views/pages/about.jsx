import { ArrowUpCircleIcon, CheckCircleIcon, CircleAlertIcon, LoaderCircleIcon } from 'lucide-react'
import Layout from '../components/layout'
import useLatestRelease, { APP_VERSION } from '../lib/use-latest-release'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const REPOSITORY_URL = 'https://github.com/nyg/crypto-tools'

function UpdateStatus() {

   const { version, url, updateAvailable, isLoading, error } = useLatestRelease()

   if (isLoading) {
      return (
         <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" />
            Checking for updates…
         </p>
      )
   }

   if (error || !version) {
      return (
         <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleAlertIcon className="size-4" />
            Could not check for updates.
         </p>
      )
   }

   if (!updateAvailable) {
      return (
         <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircleIcon className="size-4" />
            Up to date.
         </p>
      )
   }

   return (
      <p className="flex items-center gap-2 text-sm">
         <ArrowUpCircleIcon className="size-4 text-muted-foreground" />
         <span>
            Version {version} is available.{' '}
            <a href={url} target="_blank" rel="noreferrer"
               className="font-medium underline underline-offset-4">
               Release notes
            </a>
         </span>
      </p>
   )
}

export default function About() {

   return (
      <Layout name="About">
         <div className="mx-auto max-w-2xl space-y-6">

            <section className="space-y-1.5">
               <h2 className="font-heading text-2xl font-semibold tracking-tight">Crypto Tools</h2>
               <p className="text-sm text-muted-foreground">
                  {APP_VERSION ? `Version ${APP_VERSION}` : 'Development build'}
               </p>
            </section>

            <Card size="sm">
               <CardHeader>
                  <CardTitle>Updates</CardTitle>
               </CardHeader>
               <CardContent className="space-y-3">
                  <UpdateStatus />
                  <p className="text-sm text-muted-foreground">
                     Installed with Scoop or Homebrew? Update with your package manager —{' '}
                     <code className="rounded bg-muted px-1 py-0.5 text-xs">scoop update crypto-tools</code>{' '}
                     or{' '}
                     <code className="rounded bg-muted px-1 py-0.5 text-xs">brew upgrade --cask crypto-tools</code>.
                  </p>
               </CardContent>
            </Card>

            <Card size="sm">
               <CardHeader>
                  <CardTitle>Project</CardTitle>
               </CardHeader>
               <CardContent className="space-y-2 text-sm">
                  <p>
                     <a href={REPOSITORY_URL} target="_blank" rel="noreferrer"
                        className="font-medium underline underline-offset-4">
                        Source code
                     </a>
                     <span className="text-muted-foreground"> — MIT licensed.</span>
                  </p>
                  <p>
                     <a href={`${REPOSITORY_URL}/issues`} target="_blank" rel="noreferrer"
                        className="font-medium underline underline-offset-4">
                        Report an issue
                     </a>
                  </p>
               </CardContent>
            </Card>

         </div>
      </Layout>
   )
}
