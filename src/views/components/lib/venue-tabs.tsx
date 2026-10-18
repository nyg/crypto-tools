import type { ComponentType, ReactNode } from 'react'
import usePersistentState from '../../lib/use-persistent-state'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { VenueId } from '../../../types/portfolio'

export interface ExchangeVenue {
   id: VenueId
   tab: string
   label: string
   apiRoot: string
   live: boolean
   setup: ReactNode
}

export type ExchangeLayout = ComponentType<{ children: ReactNode, name: string, trailing?: ReactNode }>

export function useVenue<V extends ExchangeVenue>(storageKey: string, venues: [V, ...V[]]) {
   const [venueId, setVenueId] = usePersistentState<VenueId>(storageKey, venues[0].id)
   const current = venues.find(({ id }) => id === venueId) ?? venues[0]
   return [current, setVenueId] as const
}

interface VenueTabsProps {
   venues: ExchangeVenue[]
   value: VenueId
   onValueChange: (venue: VenueId) => void
}

export default function VenueTabs({ venues, value, onValueChange }: VenueTabsProps) {
   if (venues.length < 2) return null
   return (
      <Tabs value={value} onValueChange={venue => onValueChange(venue as VenueId)}>
         <TabsList>
            {venues.map(({ id, tab }) => <TabsTrigger key={id} value={id}>{tab}</TabsTrigger>)}
         </TabsList>
      </Tabs>
   )
}
