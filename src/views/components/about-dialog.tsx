import type { ReactNode } from 'react'
import { ArrowUpCircleIcon, CheckCircleIcon, CircleAlertIcon, LoaderCircleIcon } from 'lucide-react'
import ExternalLink from './lib/external-link'
import { APP_VERSION } from '@/lib/about-event'
import useLatestRelease from '@/lib/use-latest-release'
import useInstallInfo from '@/lib/use-install-info'
import {
   Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import type { InstallMethod } from '../../types/api'

const REPOSITORY_URL = 'https://github.com/nyg/crypto-tools'

// A package manager updates its own installs, so naming the one that matches beats
// listing both and leaving the reader to work out which applies. A manual or browser
// install has no command, and gets the download link instead.
const UPDATE_COMMANDS: Partial<Record<InstallMethod, string>> = {
   homebrew: 'brew upgrade --cask nyg/tap/crypto-tools',
   scoop: 'scoop update crypto-tools'
}

const Command = ({ children }: { children: ReactNode }) =>
   <code className="rounded bg-muted px-1 py-0.5 text-xs">{children}</code>

const SectionTitle = ({ children }: { children: ReactNode }) =>
   <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
      {children}
   </h3>

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
         <ArrowUpCircleIcon className="size-4 shrink-0 text-muted-foreground" />
         <span>
            Version {version} is available.{' '}
            <ExternalLink href={url ?? REPOSITORY_URL} className="font-medium underline underline-offset-4">
               Release notes
            </ExternalLink>
         </span>
      </p>
   )
}

function UpdateInstructions() {

   const install = useInstallInfo()
   const command = install ? UPDATE_COMMANDS[install.method] : undefined

   if (command) {
      return (
         <p className="text-sm text-muted-foreground">
            The app never updates itself. Update it with your package manager
            — <Command>{command}</Command>.
         </p>
      )
   }

   return (
      <p className="text-sm text-muted-foreground">
         The app never updates itself.{' '}
         <ExternalLink href={`${REPOSITORY_URL}/releases/latest`} className="font-medium underline underline-offset-4">
            Download the latest release
         </ExternalLink>
         {' '}to update it.
      </p>
   )
}

export default function AboutDialog({ open, onOpenChange }: {
   open: boolean
   onOpenChange: (open: boolean) => void
}) {

   return (
      <Dialog open={open} onOpenChange={onOpenChange}>
         <DialogContent>

            <DialogHeader>
               <DialogTitle>Crypto Tools</DialogTitle>
               <DialogDescription>
                  {APP_VERSION ? `Version ${APP_VERSION}` : 'Development build'}
               </DialogDescription>
            </DialogHeader>

            <section className="space-y-2">
               <SectionTitle>Updates</SectionTitle>
               <UpdateStatus />
               <UpdateInstructions />
            </section>

            <section className="space-y-2">
               <SectionTitle>Project</SectionTitle>
               <p className="text-sm">
                  <ExternalLink href={REPOSITORY_URL} className="font-medium underline underline-offset-4">
                     Source code
                  </ExternalLink>
                  <span className="text-muted-foreground"> — MIT licensed.</span>
               </p>
               <p className="text-sm">
                  <ExternalLink href={`${REPOSITORY_URL}/issues`} className="font-medium underline underline-offset-4">
                     Report an issue
                  </ExternalLink>
               </p>
            </section>

         </DialogContent>
      </Dialog>
   )
}
