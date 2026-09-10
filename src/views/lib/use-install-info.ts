import useSWR from 'swr'
import type { InstallInfo } from '../../types/api'

export const INSTALL_KEY = '/api/app/install'

// How the app was installed cannot change while it is running, so this is asked once
// and never revalidated.
export default function useInstallInfo() {

   const { data } = useSWR<InstallInfo>(INSTALL_KEY, {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false
   })

   return data ?? null
}
