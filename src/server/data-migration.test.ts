import { afterAll, describe, expect, test } from 'bun:test'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type { MigrationProgress } from './data-migration-plan'

const MODULES = {
   TEST_SECRETS_MODULE: path.join(import.meta.dir, 'secrets.ts'),
   TEST_SETTINGS_MODULE: path.join(import.meta.dir, 'settings.ts'),
   TEST_ENVIRONMENT_MODULE: path.join(import.meta.dir, 'environment.ts'),
   TEST_DATABASE_MODULE: path.join(import.meta.dir, 'db', 'database.ts'),
   TEST_MIGRATION_MODULE: path.join(import.meta.dir, 'data-migration.ts')
}

const PROVIDERS = ['kraken', 'binance', 'binanceTestnet', 'bybit', 'bybitDemo', 'anthropic'] as const
const FIELDS = ['api-key', 'api-secret'] as const

const KRAKEN_KEYS = { 'kraken-api-key': 'key-1', 'kraken-api-secret': 'secret-1' }
const COMPLETE: MigrationProgress = {
   database: true, settings: true, credentials: true, copied: Object.keys(KRAKEN_KEYS)
}

const CHILD = `
const fs = require('fs')
const path = require('path')

const store = Bun.secrets
const refused = async () => { throw new Error('no credential store') }

const breakStore = mode => {
   if (mode === 'all') Bun.secrets = { get: refused, set: refused, delete: refused }
   if (mode === 'write') Bun.secrets = { get: options => store.get(options), set: refused, delete: refused }
   if (mode === 'read-development') Bun.secrets = {
      get: options => options.service.endsWith('.dev') ? refused() : store.get(options),
      set: options => store.set(options),
      delete: options => store.delete(options)
   }
}

const environment = await import(process.env.TEST_ENVIRONMENT_MODULE)
const settings = await import(process.env.TEST_SETTINGS_MODULE)
const secrets = (await import(process.env.TEST_SECRETS_MODULE)).default
const database = await import(process.env.TEST_DATABASE_MODULE)
const { migrateDevelopmentData } = await import(process.env.TEST_MIGRATION_MODULE)

const dataDir = process.env.CRYPTO_TOOLS_DATA_DIR
const parsed = file => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : null
const out = {}

for (const step of JSON.parse(process.env.TEST_STEPS)) {
   if (step.op === 'breakStore') breakStore(step.mode)
   if (step.op === 'production') environment.useProductionData()
   if (step.op === 'settings') {
      fs.writeFileSync(settings.settingsFilePath(step.profile), JSON.stringify(step.value, null, 3))
   }
   if (step.op === 'portfolio') {
      database.getDatabase().run(
         "INSERT INTO portfolio (venue, account_id, name, quote_asset, band, created_at) VALUES ('kraken', 'account', ?, 'USD', '0.05', 0)",
         [step.name])
      database.closeDatabase()
   }
   if (step.op === 'save') await secrets.save(step.value)
   if (step.op === 'migrate') await migrateDevelopmentData()
   if (step.op === 'drain') await secrets.migrate()
   if (step.op === 'read') out.read = await secrets.secretsFor(step.provider)
   if (step.op === 'accountId') out.accountId = settings.krakenAccountId()
   if (step.op === 'portfolios') {
      out.portfolios = database.getDatabase().query('SELECT name FROM portfolio ORDER BY id').all().map(row => row.name)
      database.closeDatabase()
   }
}

out.files = fs.readdirSync(dataDir).sort()
out.marker = parsed(path.join(dataDir, 'data-migration.json'))
out.settings = parsed(path.join(dataDir, 'settings.json'))

console.log('__RESULT__' + JSON.stringify(out))
`

type Step =
   | { op: 'breakStore', mode: 'all' | 'write' | 'read-development' }
   | { op: 'production' }
   | { op: 'settings', profile: 'production' | 'development', value: unknown }
   | { op: 'portfolio', name: string }
   | { op: 'save', value: unknown }
   | { op: 'migrate' }
   | { op: 'drain' }
   | { op: 'read', provider: string }
   | { op: 'accountId' }
   | { op: 'portfolios' }

interface Result {
   read?: { apiKey: string, apiSecret: string, store: string }
   accountId?: string
   portfolios?: string[]
   files: string[]
   marker: MigrationProgress | null
   settings: Record<string, Record<string, string>> | null
}

interface Account { dataDir: string, service: string }

const accounts: Account[] = []

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

const developmentService = ({ service }: Account) => `${service}.dev`

function account(): Account {
   const created = {
      dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'crypto-tools-migration-')),
      service: `io.github.nyg.crypto-tools.test.migration.${process.pid}.${accounts.length}`
   }
   accounts.push(created)
   return created
}

async function upgradedInstall(): Promise<Account> {
   const created = account()

   for (const [name, value] of Object.entries(KRAKEN_KEYS)) {
      await Bun.secrets.set({ service: developmentService(created), name, value })
   }

   return created
}

function run(steps: Step[], { dataDir, service }: Account = account()): Result {
   const result = Bun.spawnSync({
      cmd: ['bun', 'run', '-'],
      stdin: Buffer.from(CHILD),
      env: {
         ...process.env,
         ...MODULES,
         CRYPTO_TOOLS_DATA_DIR: dataDir,
         CRYPTO_TOOLS_KEYCHAIN_SERVICE: service,
         TEST_STEPS: JSON.stringify(steps)
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
   for (const created of accounts) {
      for (const service of [created.service, developmentService(created)]) {
         for (const provider of PROVIDERS) {
            for (const field of FIELDS) {
               await Bun.secrets.delete({ service, name: `${provider}-${field}` }).catch(() => null)
            }
         }
      }
      fs.rmSync(created.dataDir, { recursive: true, force: true })
   }
})

describe('the first start of a released build', () => {

   needsStore('shows an upgraded install the keys, account id and rows it had', async () => {
      const upgraded = await upgradedInstall()

      const { read, accountId, portfolios, files, marker } = run([
         { op: 'portfolio', name: 'Core' },
         { op: 'settings', profile: 'development', value: { version: 2, kraken: { accountId: 'account-1' } } },
         { op: 'production' },
         { op: 'migrate' },
         { op: 'drain' },
         { op: 'read', provider: 'kraken' },
         { op: 'accountId' },
         { op: 'portfolios' }
      ], upgraded)

      expect(read?.apiKey).toBe('key-1')
      expect(read?.apiSecret).toBe('secret-1')
      expect(read?.store).toBe(nativeStore())
      expect(accountId).toBe('account-1')
      expect(portfolios).toEqual(['Core'])
      expect(marker).toEqual(COMPLETE)
      expect(files).toContain('ledger-dev.db')
      expect(files).toContain('settings-dev.json')
      expect(await Bun.secrets.get({ service: developmentService(upgraded), name: 'kraken-api-key' }))
         .toBe('key-1')
   })

   test('replaces a production database that holds no account data', () => {
      const { portfolios } = run([
         { op: 'portfolio', name: 'Core' },
         { op: 'production' },
         { op: 'portfolios' },
         { op: 'migrate' },
         { op: 'portfolios' }
      ])

      expect(portfolios).toEqual(['Core'])
   })

   test('leaves production alone when it is already in use', () => {
      const { accountId, portfolios, marker } = run([
         { op: 'portfolio', name: 'Core' },
         { op: 'settings', profile: 'development', value: { version: 2, kraken: { accountId: 'development' } } },
         { op: 'settings', profile: 'production', value: { version: 2, kraken: { accountId: 'production' } } },
         { op: 'production' },
         { op: 'migrate' },
         { op: 'accountId' },
         { op: 'portfolios' }
      ])

      expect(accountId).toBe('production')
      expect(portfolios).toEqual([])
      expect(marker).toEqual({ ...COMPLETE, copied: [] })
   })

   test('creates no development name on a fresh install', () => {
      const { files } = run([
         { op: 'production' },
         { op: 'migrate' },
         { op: 'portfolios' }
      ])

      expect(files).toContain('ledger.db')
      expect(files).toContain('data-migration.json')
      expect(files.filter(name => name.includes('-dev'))).toEqual([])
   })
})

describe('when the credential store refuses', () => {

   test('every call, the keys the settings file held still arrive', () => {
      const { read, accountId, marker } = run([
         { op: 'breakStore', mode: 'all' },
         { op: 'settings', profile: 'development', value: {
            version: 2, kraken: { apiKey: 'file-key', apiSecret: 'file-secret', accountId: 'account-1' }
         } },
         { op: 'production' },
         { op: 'migrate' },
         { op: 'drain' },
         { op: 'read', provider: 'kraken' },
         { op: 'accountId' }
      ])

      expect(read?.apiKey).toBe('file-key')
      expect(read?.apiSecret).toBe('file-secret')
      expect(read?.store).toBe('file')
      expect(accountId).toBe('account-1')
      expect(marker).toEqual({ database: true, settings: true, credentials: false, copied: [] })
   })

   needsStore('a write, the key goes to the settings file instead', async () => {
      const { read, settings, marker } = run([
         { op: 'production' },
         { op: 'breakStore', mode: 'write' },
         { op: 'migrate' },
         { op: 'read', provider: 'kraken' }
      ], await upgradedInstall())

      expect(read?.apiKey).toBe('key-1')
      expect(read?.store).toBe('file')
      expect(settings?.kraken?.apiKey).toBe('key-1')
      expect(settings?.kraken?.apiSecret).toBe('secret-1')
      expect(marker).toEqual(COMPLETE)
   })

   needsStore('a read, the next start finishes the job', async () => {
      const upgraded = await upgradedInstall()

      const refused = run([
         { op: 'production' },
         { op: 'breakStore', mode: 'read-development' },
         { op: 'migrate' },
         { op: 'read', provider: 'kraken' }
      ], upgraded)

      expect(refused.read?.apiKey).toBe('')
      expect(refused.marker).toEqual({ database: true, settings: true, credentials: false, copied: [] })

      const finished = run([
         { op: 'production' },
         { op: 'migrate' },
         { op: 'read', provider: 'kraken' }
      ], upgraded)

      expect(finished.read?.apiKey).toBe('key-1')
      expect(finished.read?.apiSecret).toBe('secret-1')
      expect(finished.marker).toEqual(COMPLETE)
   })
})

describe('a later start', () => {

   needsStore('does not bring back a key removed since the migration', async () => {
      const upgraded = await upgradedInstall()

      run([{ op: 'production' }, { op: 'migrate' }], upgraded)

      const { read } = run([
         { op: 'production' },
         { op: 'save', value: { kraken: { apiKey: '', apiSecret: '' } } },
         { op: 'migrate' },
         { op: 'read', provider: 'kraken' }
      ], upgraded)

      expect(read?.apiKey).toBe('')
      expect(read?.apiSecret).toBe('')
   })
})

describe('a development build', () => {

   test('creates no production name in the data directory', () => {
      const { files } = run([
         { op: 'breakStore', mode: 'all' },
         { op: 'portfolio', name: 'Core' },
         { op: 'save', value: { kraken: { apiKey: 'key-1', apiSecret: 'secret-1' } } }
      ])

      expect(files).toContain('ledger-dev.db')
      expect(files).toContain('settings-dev.json')
      expect(files).not.toContain('ledger.db')
      expect(files).not.toContain('settings.json')
      expect(files).not.toContain('data-migration.json')
   })

   needsStore('keeps its keys out of the production service', async () => {
      const development = account()

      run([{ op: 'save', value: { kraken: { apiKey: 'key-1', apiSecret: 'secret-1' } } }], development)

      expect(await Bun.secrets.get({ service: developmentService(development), name: 'kraken-api-key' }))
         .toBe('key-1')
      expect(await Bun.secrets.get({ service: development.service, name: 'kraken-api-key' }))
         .toBeNull()
   })
})

function nativeStore(): string {
   if (process.platform === 'darwin') return 'keychain'
   if (process.platform === 'win32') return 'credential-manager'
   return 'keyring'
}
