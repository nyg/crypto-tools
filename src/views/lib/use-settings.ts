import useSWR from 'swr'
import type { MaskedProvider, MaskedSettings } from '../../types/settings'
import type { Provider } from '../../types/credentials'

export const SETTINGS_KEY = '/api/settings'

// The keys themselves are withheld unless asked for, so only the Settings form uses
// this variant; everything else reads the booleans from the key above.
export const SETTINGS_REVEAL_KEY = '/api/settings?reveal=true'

export default function useSettings(key: string = SETTINGS_KEY) {

   const { data, error, isLoading, mutate } = useSWR<MaskedSettings>(key, { revalidateOnFocus: false })

   return {
      settings: data,
      accountId: data?.kraken?.accountId ?? null,
      isLoading,
      error,
      mutate
   }
}

export function useProvider(provider: Provider) {

   const { settings, error, isLoading, mutate } = useSettings()
   const entry: MaskedProvider | undefined = settings?.[provider]

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
