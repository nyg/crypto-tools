const APP_IDENTIFIER = 'io.github.nyg.crypto-tools'

const serviceName = () => process.env.NODE_ENV === 'production'
   ? APP_IDENTIFIER
   : `${APP_IDENTIFIER}-dev`

const backends = {
   darwin: () => import('./macos.js'),
   win32: () => import('./windows.js')
}

const FAILURE_TTL_MS = 30_000

let store = null
let resolved = false

const cache = new Map()
const failures = new Map()

export async function initSecretStore() {
   if (resolved) return store
   resolved = true

   const load = backends[process.platform]
   if (!load || process.env.CRYPTO_TOOLS_SECRET_STORE === 'file') return store

   try {
      const { default: createStore } = await load()
      const candidate = createStore(serviceName())
      if (candidate.available()) store = candidate
   }
   catch (error) {
      console.warn('Could not reach the operating system credential store, falling back to the settings file:', error.message)
   }

   return store
}

export function secretStore() {
   return store
}

export function readSecret(name) {
   if (!store) return null
   if (cache.has(name)) return cache.get(name)

   const failure = failures.get(name)
   if (failure && Date.now() - failure.at < FAILURE_TTL_MS) throw failure.error

   let value
   try {
      value = store.read(name)
   }
   catch (error) {
      failures.set(name, { error, at: Date.now() })
      throw error
   }

   failures.delete(name)
   cache.set(name, value)
   return value
}

export function writeSecret(name, value) {
   if (!store) return false
   cache.delete(name)
   failures.delete(name)

   try {
      return store.write(name, value)
   }
   catch (error) {
      console.warn(`Could not write ${name} to the credential store:`, error.message)
      return false
   }
}

export function removeSecret(name) {
   if (!store) return false
   cache.delete(name)
   failures.delete(name)

   try {
      return store.remove(name)
   }
   catch (error) {
      console.warn(`Could not remove ${name} from the credential store:`, error.message)
      return false
   }
}
