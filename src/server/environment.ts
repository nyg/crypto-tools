let enabled = process.env.NODE_ENV === 'development'

export function allowEnvironmentOverrides(): void {
   enabled = true
}

export function environmentOverridesEnabled(): boolean {
   return enabled
}
