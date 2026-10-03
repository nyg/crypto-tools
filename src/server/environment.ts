let enabled = false

export function allowEnvironmentOverrides(): void {
   enabled = true
}

export function environmentOverridesEnabled(): boolean {
   return enabled
}
