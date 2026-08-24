import type { ReactNode } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'

// Every page depends on the settings request now, so a server that is down must not
// be reported as "you have no keys": that sends the user to a page which will fail
// the same way and show empty fields for keys that are still on disk.
interface CredentialsAlertProps {
   unreachable?: boolean
   children?: ReactNode
}

export default function CredentialsAlert({ unreachable, children }: CredentialsAlertProps) {

   if (unreachable) {
      return (
         <Alert variant="destructive">
            <AlertDescription>
               Could not reach the local server, so your API keys could not be read. They are
               still where you left them — start the app again, and this page will work.
            </AlertDescription>
         </Alert>
      )
   }

   return (
      <Alert>
         <AlertDescription>{children}</AlertDescription>
      </Alert>
   )
}
