import ExternalLink from './lib/external-link'
import { APP_VERSION } from '@/lib/about-event'
import {
   Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle
} from '@/components/ui/dialog'

const REPOSITORY_URL = 'https://github.com/nyg/crypto-tools'

const Command = ({ children }) =>
   <code className="rounded bg-muted px-1 py-0.5 text-xs">{children}</code>

const SectionTitle = ({ children }) =>
   <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
      {children}
   </h3>

export default function AboutDialog({ open, onOpenChange }) {

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
               <p className="text-sm text-muted-foreground">
                  The app never updates itself. Installed with Scoop or Homebrew? Update it
                  with your package manager — <Command>scoop update crypto-tools</Command> or{' '}
                  <Command>brew upgrade --cask nyg/tap/crypto-tools</Command>.
               </p>
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
