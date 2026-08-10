import useSWR from 'swr'

export const SETTINGS_KEY = '/api/settings'

// The keys themselves are withheld unless asked for, so only the Settings form uses
// this variant; everything else reads the booleans from the key above.
export const SETTINGS_REVEAL_KEY = '/api/settings?reveal=true'

export default function useSettings(key = SETTINGS_KEY) {

   const { data, error, isLoading, mutate } = useSWR(key, { revalidateOnFocus: false })

   return {
      settings: data,
      accountId: data?.kraken?.accountId ?? null,
      isLoading,
      error,
      mutate
   }
}

export function useProvider(provider) {

   const { settings, error, isLoading, mutate } = useSettings()
   const entry = settings?.[provider]

   return {
      configured: Boolean(entry?.configured),
      keyConfigured: Boolean(entry?.keyConfigured),
      accountId: settings?.kraken?.accountId ?? null,
      source: entry?.source ?? 'file',
      unreachable: Boolean(error),
      error,
      isLoading,
      mutate
   }
}
