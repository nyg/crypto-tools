import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
   ArrowUpCircleIcon, CheckCircleIcon, CheckIcon, CircleAlertIcon, CopyIcon, RefreshCwIcon, XIcon
} from 'lucide-react'
import ExternalLink from './lib/external-link'
import { APP_VERSION } from '@/lib/about-event'
import { copyText } from '@/lib/clipboard'
import useLatestRelease from '@/lib/use-latest-release'
import useInstallInfo from '@/lib/use-install-info'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
   Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle
} from '@/components/ui/dialog'
import { asLocalTimestamp } from '../../utils/format'
import type { InstallMethod } from '../../types/api'

const REPOSITORY_URL = 'https://github.com/nyg/crypto-tools'
const COPIED_FEEDBACK_MS = 1500

// A package manager updates its own installs, so naming the one that matches beats
// listing both and leaving the reader to work out which applies. A manual or browser
// install has no command, and gets a download link once a newer version exists.
const UPDATE_COMMANDS: Partial<Record<InstallMethod, { command: string, manager: string }>> = {
   homebrew: { command: 'brew upgrade --cask nyg/tap/crypto-tools', manager: 'Homebrew' },
   scoop: { command: 'scoop update crypto-tools', manager: 'Scoop' }
}

const SectionTitle = ({ children }: { children: ReactNode }) =>
   <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
      {children}
   </h3>

const StatusLine = ({ icon, className, children }: { icon: ReactNode, className?: string, children: ReactNode }) =>
   <p className={cn('flex items-center gap-2 text-xs [&_svg]:size-3.5 [&_svg]:shrink-0', className)}>
      {icon}
      {children}
   </p>

function CopyButton({ value }: { value: string }) {

   const [copied, setCopied] = useState(false)

   useEffect(() => {
      if (!copied) return
      const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
      return () => clearTimeout(timer)
   }, [copied])

   const label = copied ? 'Copied' : 'Copy'

   return (
      <Button
         variant="ghost"
         size="icon-xs"
         title={label}
         aria-label={label}
         onClick={() => copyText(value).then(setCopied)}>
         {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
   )
}

function UpdateStatus({ version, url, updateAvailable, isLoading, error }: ReturnType<typeof useLatestRelease>) {

   if (isLoading) {
      return (
         <StatusLine icon={<RefreshCwIcon className="animate-spin" />} className="text-muted-foreground">
            Checking for updates…
         </StatusLine>
      )
   }

   if (error || !version) {
      return (
         <StatusLine icon={<CircleAlertIcon />} className="text-muted-foreground">
            Could not check for updates.
         </StatusLine>
      )
   }

   if (!updateAvailable) {
      return (
         <StatusLine icon={<CheckCircleIcon />} className="text-muted-foreground">
            Up to date.
         </StatusLine>
      )
   }

   return (
      <StatusLine icon={<ArrowUpCircleIcon className="text-muted-foreground" />}>
         <span>
            Version {version} is available.{' '}
            <ExternalLink href={url ?? REPOSITORY_URL} className="font-medium underline underline-offset-4">
               Release notes
            </ExternalLink>
         </span>
      </StatusLine>
   )
}

function UpdateSection() {

   const release = useLatestRelease()
   const install = useInstallInfo()

   const update = install ? UPDATE_COMMANDS[install.method] : undefined
   const showDownloadLink = install !== null && !update && release.updateAvailable

   return (
      <section className="space-y-3">

         <div className="flex items-center justify-between gap-2">
            <SectionTitle>Updates</SectionTitle>
            <Button variant="outline" size="sm" onClick={release.check} disabled={release.isLoading}>
               <RefreshCwIcon className={cn(release.isLoading && 'animate-spin')} />
               Check now
            </Button>
         </div>

         <div className="space-y-1">
            <UpdateStatus {...release} />
            {release.checkedAt &&
               <p className="text-xs text-muted-foreground">
                  Last checked {asLocalTimestamp(new Date(release.checkedAt))}
               </p>}
         </div>

         {update &&
            <div className="space-y-1">
               <p className="text-xs text-muted-foreground">
                  The app does not update itself. Update it with {update.manager}:
               </p>
               <div className="flex items-center gap-1 rounded bg-muted py-1 pr-1 pl-2">
                  <code className="flex-1 truncate font-mono text-[0.7rem]">{update.command}</code>
                  <CopyButton value={update.command} />
               </div>
            </div>}

         {showDownloadLink &&
            <p className="text-xs">
               <ExternalLink href={release.url ?? `${REPOSITORY_URL}/releases/latest`} className="font-medium underline underline-offset-4">
                  Download the new version
               </ExternalLink>
            </p>}

      </section>
   )
}

export default function AboutDialog({ open, onOpenChange }: {
   open: boolean
   onOpenChange: (open: boolean) => void
}) {

   return (
      <Dialog open={open} onOpenChange={onOpenChange}>
         <DialogContent
            showCloseButton={false}
            className="flex max-h-[90vh] flex-col gap-0 overflow-hidden bg-card p-0 text-card-foreground shadow-xl sm:max-w-[460px]">

            <header className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
               <DialogTitle className="text-sm">About</DialogTitle>
               <DialogClose asChild>
                  <Button variant="ghost" size="icon-sm" title="Close" aria-label="Close" className="text-muted-foreground hover:text-foreground">
                     <XIcon className="size-3.5" />
                  </Button>
               </DialogClose>
            </header>

            <div className="flex-1 space-y-6 overflow-y-auto p-4">

               <section className="space-y-1">
                  <h3 className="font-heading text-sm font-semibold">Crypto Tools</h3>
                  <DialogDescription className="text-xs tabular-nums">
                     {APP_VERSION ? `Version ${APP_VERSION}` : 'Development build'}
                  </DialogDescription>
               </section>

               <UpdateSection />

               <section className="space-y-2">
                  <SectionTitle>Project</SectionTitle>
                  <p className="text-xs">
                     <ExternalLink href={REPOSITORY_URL} className="font-medium underline underline-offset-4">
                        Source code
                     </ExternalLink>
                     <span className="text-muted-foreground"> — MIT licensed.</span>
                  </p>
                  <p className="text-xs">
                     <ExternalLink href={`${REPOSITORY_URL}/issues`} className="font-medium underline underline-offset-4">
                        Report an issue
                     </ExternalLink>
                  </p>
               </section>

            </div>

         </DialogContent>
      </Dialog>
   )
}
