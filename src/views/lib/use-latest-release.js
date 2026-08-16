import useSWR from 'swr'

export const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? ''

export const LATEST_RELEASE_KEY = '/api/app/latest-release'

const parts = (version) =>
   String(version).split('-')[0].split('.').map(part => parseInt(part, 10) || 0)

export function isNewer(candidate, current) {
   if (!candidate || !current) return false

   const [left, right] = [parts(candidate), parts(current)]
   for (let index = 0; index < Math.max(left.length, right.length); index++) {
      const difference = (left[index] ?? 0) - (right[index] ?? 0)
      if (difference !== 0) return difference > 0
   }

   return !String(candidate).includes('-') && String(current).includes('-')
}

export default function useLatestRelease() {

   const { data, error, isLoading } = useSWR(LATEST_RELEASE_KEY, {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      shouldRetryOnError: false
   })

   return {
      version: data?.version ?? null,
      url: data?.url ?? null,
      updateAvailable: isNewer(data?.version, APP_VERSION),
      isLoading,
      error
   }
}
