export type DataProfile = 'production' | 'development'

let enabled = false
let profile: DataProfile = 'development'

export function allowEnvironmentOverrides(): void {
   enabled = true
}

export function environmentOverridesEnabled(): boolean {
   return enabled
}

export function useProductionData(): void {
   profile = 'production'
}

export function dataProfile(): DataProfile {
   return profile
}
