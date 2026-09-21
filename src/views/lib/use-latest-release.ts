import { useState } from 'react'
import useSWR from 'swr'
import { APP_VERSION } from './about-event'
import { fetcher } from './fetcher'
import type { LatestRelease } from '../../types/api'

export const LATEST_RELEASE_KEY = '/api/app/latest-release'
const REFRESH_SERVER_CACHE_KEY = `${LATEST_RELEASE_KEY}?refresh=1`

const segments = (version: string) => {
   const [core = ''] = String(version).split('-')
   return core.split('.').map(part => parseInt(part, 10) || 0)
}

export function isNewer(candidate: string | null | undefined, current: string | null | undefined): boolean {

   if (!candidate || !current) return false

   const [left, right] = [segments(candidate), segments(current)]
   for (let index = 0; index < Math.max(left.length, right.length); index++) {
      const difference = (left[index] ?? 0) - (right[index] ?? 0)
      if (difference !== 0) return difference > 0
   }

   return !String(candidate).includes('-') && String(current).includes('-')
}

export default function useLatestRelease() {

   const [rechecking, setRechecking] = useState(false)
   const { data, error, isLoading, mutate } = useSWR<LatestRelease>(LATEST_RELEASE_KEY, {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      shouldRetryOnError: false
   })

   const check = async () => {
      setRechecking(true)
      await fetcher(REFRESH_SERVER_CACHE_KEY).catch(() => undefined)
      await mutate()
      setRechecking(false)
   }

   return {
      version: data?.version ?? null,
      url: data?.url ?? null,
      checkedAt: error ? null : data?.checkedAt ?? null,
      updateAvailable: isNewer(data?.version, APP_VERSION),
      isLoading: isLoading || rechecking,
      error,
      check
   }
}
