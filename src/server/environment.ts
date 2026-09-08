// Environment variables are a web-mode and development affordance: a server run by hand
// takes its keys from the shell, and a packaged desktop build never does. NODE_ENV
// cannot answer this on its own — an Electrobun build launched from a terminal inherits
// whatever the shell exports and runs with NODE_ENV unset — so the entry point that
// wants the behaviour asks for it.
let enabled = process.env.NODE_ENV === 'development'

export function allowEnvironmentOverrides(): void {
   enabled = true
}

export function environmentOverridesEnabled(): boolean {
   return enabled
}
