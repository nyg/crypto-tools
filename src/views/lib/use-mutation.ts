import useSWRMutation from 'swr/mutation'
import { fetcher } from './fetcher'

// SWR's types require a fetcher argument, but the hook falls back to the one SWRConfig
// supplies — swr's withArgs does `fn || config.fetcher` before the hook ever sees it,
// which is where every mutation in this app has always got it from. Passing the same
// function explicitly says so in a way the types can follow, rather than asserting past
// a signature that does not describe the fallback.
export default function useMutation<Data, Arg = unknown>(key: string | null) {
   return useSWRMutation<Data, unknown, string | null, Arg>(
      key,
      (url, options) => fetcher(url, options) as Promise<Data>)
}
