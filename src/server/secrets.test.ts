import { afterAll, describe, expect, test } from 'bun:test'
import fs from 'fs'
import os from 'os'
import path from 'path'

const SECRETS_MODULE = path.join(import.meta.dir, 'secrets.ts')
const SETTINGS_MODULE = path.join(import.meta.dir, 'settings.ts')
const ENVIRONMENT_MODULE = path.join(import.meta.dir, 'environment.ts')

const PROVIDERS = ['kraken', 'binance', 'anthropic'] as const
const FIELDS = ['api-key', 'api-secret'] as const

// Every step runs in a child process: the modules hold process-wide state — the
// environment gate, the warn-once flag — and the data directory is read at import time.
const CHILD = `
if (process.env.TEST_BREAK_CREDENTIAL_STORE) {
   const unavailable = async () => { throw new Error('no credential store') }
   Bun.secrets = { get: unavailable, set: unavailable, delete: unavailable }
}

const secrets = (await import(process.env.TEST_SECRETS_MODULE)).default
const settings = await import(process.env.TEST_SETTINGS_MODULE)
const environment = await import(process.env.TEST_ENVIRONMENT_MODULE)
const out = {}

for (const step of JSON.parse(process.env.TEST_STEPS)) {
   if (step.op === 'webMode') environment.allowEnvironmentOverrides()
   if (step.op === 'seed') {
      const file = settings.settingsFilePath()
      require('fs').mkdirSync(require('path').dirname(file), { recursive: true })
      require('fs').writeFileSync(file, JSON.stringify(step.value, null, 3))
   }
   if (step.op === 'save') await secrets.save(step.value)
   if (step.op === 'migrate') await secrets.migrate()
   if (step.op === 'read') out.read = await secrets.secretsFor(step.provider)
   if (step.op === 'accountId') out.accountId = settings.krakenAccountId()
}

const file = settings.settingsFilePath()
out.file = require('fs').existsSync(file)
   ? JSON.parse(require('fs').readFileSync(file, 'utf-8'))
   : null

console.log('__RESULT__' + JSON.stringify(out))
`

type Step =
   | { op: 'seed', value: unknown }
   | { op: 'save', value: unknown }
   | { op: 'migrate' }
   | { op: 'read', provider: string }
   | { op: 'accountId' }
   | { op: 'webMode' }

interface Result {
   read?: { apiKey: string, apiSecret: string, store: string }
   accountId?: string
   file: Record<string, Record<string, string>> | null
}

const services: string[] = []
const homes: string[] = []

// A CI runner with no secret service — the stock Ubuntu image is one — exercises only
// the fallback half of this file. Probing once says which half is running rather than
// reporting the missing daemon as a defect.
const storeAvailable = await (async () => {
   const service = `io.github.nyg.crypto-tools.test.probe.${process.pid}`
   try {
      await Bun.secrets.set({ service, name: 'probe', value: 'probe' })
      await Bun.secrets.delete({ service, name: 'probe' })
      return true
   }
   catch {
      return false
   }
})()

const needsStore = test.skipIf(!storeAvailable)

interface Account { dataDir: string, service: string }

// A pair of a data directory and a credential-store service, so a test can run two
// child processes against the same stored state.
function account(): Account {
   const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crypto-tools-secrets-'))
   const service = `io.github.nyg.crypto-tools.test.${process.pid}.${services.length}`
   homes.push(dataDir)
   services.push(service)
   return { dataDir, service }
}

function run(
   steps: Step[], env: Record<string, string | undefined> = {}, reuse?: Account
): Result {

   const { dataDir, service } = reuse ?? account()

   const result = Bun.spawnSync({
      cmd: ['bun', 'run', '-'],
      stdin: Buffer.from(CHILD),
      env: {
         ...process.env,
         NODE_ENV: 'production',
         CRYPTO_TOOLS_DATA_DIR: dataDir,
         CRYPTO_TOOLS_KEYCHAIN_SERVICE: service,
         TEST_SECRETS_MODULE: SECRETS_MODULE,
         TEST_SETTINGS_MODULE: SETTINGS_MODULE,
         TEST_ENVIRONMENT_MODULE: ENVIRONMENT_MODULE,
         TEST_STEPS: JSON.stringify(steps),
         ...env
      }
   })

   const stdout = result.stdout.toString()
   const marker = stdout.lastIndexOf('__RESULT__')

   if (marker === -1) {
      throw new Error(`Child produced no result.\n${stdout}\n${result.stderr.toString()}`)
   }

   return JSON.parse(stdout.slice(marker + '__RESULT__'.length)) as Result
}

afterAll(async () => {
   for (const service of services) {
      for (const provider of PROVIDERS) {
         for (const field of FIELDS) {
            await Bun.secrets.delete({ service, name: `${provider}-${field}` }).catch(() => null)
         }
      }
   }
   for (const home of homes) fs.rmSync(home, { recursive: true, force: true })
})

describe('the OS credential store', () => {

   needsStore('round-trips a credential and keeps it out of the settings file', () => {
      const { read, file } = run([
         { op: 'save', value: { kraken: { apiKey: 'key-1', apiSecret: 'secret-1' } } },
         { op: 'read', provider: 'kraken' }
      ])

      expect(read?.apiKey).toBe('key-1')
      expect(read?.apiSecret).toBe('secret-1')
      expect(read?.store).toBe(nativeStore())
      expect(file?.kraken?.apiKey).toBeUndefined()
      expect(file?.kraken?.apiSecret).toBeUndefined()
   })

   test('derives the account id when a Kraken key is saved', () => {
      const { accountId, file } = run([
         { op: 'save', value: { kraken: { apiKey: 'key-2', apiSecret: 'secret-2' } } },
         { op: 'accountId' }
      ])

      expect(accountId).toMatch(/^[0-9a-f]{16}$/)
      expect(file?.kraken?.accountId).toBe(accountId as unknown as string)
   })

   test('keeps the account id when the key is rotated', () => {
      const first = run([
         { op: 'save', value: { kraken: { apiKey: 'key-3', apiSecret: 'secret-3' } } },
         { op: 'accountId' }
      ])

      const rotated = run([
         { op: 'seed', value: { version: 2, kraken: { accountId: first.accountId } } },
         { op: 'save', value: { kraken: { apiKey: 'rotated', apiSecret: 'secret-3' } } },
         { op: 'accountId' }
      ])

      expect(rotated.accountId).toBe(first.accountId as string)
   })

   test('clears the account id when the key is removed', () => {
      const { accountId } = run([
         { op: 'save', value: { kraken: { apiKey: 'key-4', apiSecret: 'secret-4' } } },
         { op: 'save', value: { kraken: { apiKey: '', apiSecret: '' } } },
         { op: 'accountId' }
      ])

      expect(accountId).toBe('')
   })
})

describe('migration out of the settings file', () => {

   needsStore('moves a plaintext key into the store and prunes it', () => {
      const { read, file } = run([
         { op: 'seed', value: {
            version: 1,
            kraken: { apiKey: 'legacy-key', apiSecret: 'legacy-secret', accountId: 'kept' },
            binance: {}, anthropic: {}
         } },
         { op: 'migrate' },
         { op: 'read', provider: 'kraken' }
      ])

      expect(read?.apiKey).toBe('legacy-key')
      expect(read?.apiSecret).toBe('legacy-secret')
      expect(read?.store).toBe(nativeStore())
      expect(file?.kraken?.apiKey).toBeUndefined()
      expect(file?.kraken?.apiSecret).toBeUndefined()
      expect(file?.kraken?.accountId).toBe('kept')
   })

   needsStore('fills in a missing account id before draining the key', () => {
      const { accountId, file } = run([
         { op: 'seed', value: {
            version: 1,
            kraken: { apiKey: 'legacy-key', apiSecret: 'legacy-secret', accountId: '' },
            binance: {}, anthropic: {}
         } },
         { op: 'migrate' },
         { op: 'accountId' }
      ])

      expect(accountId).toMatch(/^[0-9a-f]{16}$/)
      expect(file?.kraken?.apiKey).toBeUndefined()
   })

   test('leaves the file alone when the store refuses', () => {
      const { read, file } = run([
         { op: 'seed', value: {
            version: 1,
            kraken: { apiKey: 'legacy-key', apiSecret: 'legacy-secret', accountId: 'kept' },
            binance: {}, anthropic: {}
         } },
         { op: 'migrate' },
         { op: 'read', provider: 'kraken' }
      ], { TEST_BREAK_CREDENTIAL_STORE: '1' })

      expect(file?.kraken?.apiKey).toBe('legacy-key')
      expect(file?.kraken?.apiSecret).toBe('legacy-secret')
      expect(read?.apiKey).toBe('legacy-key')
      expect(read?.store).toBe('file')
   })
})

describe('when the credential store is unavailable', () => {

   needsStore('a later save prunes the plaintext the fallback left behind', () => {
      const shared = account()

      const fallback = run([
         { op: 'save', value: { binance: { apiKey: 'first-key', apiSecret: 'first-secret' } } },
         { op: 'read', provider: 'binance' }
      ], { TEST_BREAK_CREDENTIAL_STORE: '1' }, shared)

      expect(fallback.file?.binance?.apiKey).toBe('first-key')
      expect(fallback.read?.store).toBe('file')

      const recovered = run([
         { op: 'save', value: { binance: { apiKey: 'second-key', apiSecret: 'second-secret' } } },
         { op: 'read', provider: 'binance' }
      ], {}, shared)

      expect(recovered.read?.apiKey).toBe('second-key')
      expect(recovered.read?.store).toBe(nativeStore())
      expect(recovered.file?.binance?.apiKey).toBeUndefined()
      expect(recovered.file?.binance?.apiSecret).toBeUndefined()
   })

   test('saving falls back to the settings file rather than losing the value', () => {
      const { read, file } = run([
         { op: 'save', value: { binance: { apiKey: 'fallback-key', apiSecret: 'fallback-secret' } } },
         { op: 'read', provider: 'binance' }
      ], { TEST_BREAK_CREDENTIAL_STORE: '1' })

      expect(file?.binance?.apiKey).toBe('fallback-key')
      expect(file?.binance?.apiSecret).toBe('fallback-secret')
      expect(read?.apiKey).toBe('fallback-key')
      expect(read?.store).toBe('file')
   })
})

describe('environment overrides', () => {

   test('win over the store once the web entry point asks for them', () => {
      const { read } = run([
         { op: 'save', value: { anthropic: { apiKey: 'stored-key' } } },
         { op: 'webMode' },
         { op: 'read', provider: 'anthropic' }
      ], { ANTHROPIC_API_KEY: 'env-key' })

      expect(read?.apiKey).toBe('env-key')
      expect(read?.store).toBe('env')
   })

   needsStore('are ignored in a packaged build that never asks', () => {
      const { read } = run([
         { op: 'save', value: { anthropic: { apiKey: 'stored-key' } } },
         { op: 'read', provider: 'anthropic' }
      ], { ANTHROPIC_API_KEY: 'env-key' })

      expect(read?.apiKey).toBe('stored-key')
      expect(read?.store).toBe(nativeStore())
   })

   test('are ignored when only half a credential is exported', () => {
      const { read } = run([
         { op: 'save', value: { kraken: { apiKey: 'stored-key', apiSecret: 'stored-secret' } } },
         { op: 'webMode' },
         { op: 'read', provider: 'kraken' }
      ], { KRAKEN_API_KEY: 'env-key' })

      expect(read?.apiKey).toBe('stored-key')
      expect(read?.apiSecret).toBe('stored-secret')
   })
})

function nativeStore(): string {
   if (process.platform === 'darwin') return 'keychain'
   if (process.platform === 'win32') return 'credential-manager'
   return 'keyring'
}
