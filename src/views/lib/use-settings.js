import useSWR from 'swr'

export const SETTINGS_KEY = '/api/settings'

export default function useSettings() {

   const { data, error, isLoading, mutate } = useSWR(SETTINGS_KEY, { revalidateOnFocus: false })

   return {
      settings: data,
      accountId: data?.kraken?.accountId ?? null,
      isLoading,
      error,
      mutate
   }
}

export function useProvider(provider) {

   const { settings, isLoading, mutate } = useSettings()
   const entry = settings?.[provider]

   return {
      configured: Boolean(entry?.configured),
      keyConfigured: Boolean(entry?.keyConfigured),
      accountId: settings?.kraken?.accountId ?? null,
      source: entry?.source ?? 'file',
      isLoading,
      mutate
   }
}
