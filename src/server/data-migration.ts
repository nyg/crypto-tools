import { readFileSync, renameSync, writeFileSync } from 'fs'
import path from 'path'
import { isComplete, planDataMigration, productionInUse } from './data-migration-plan'
import { copyDatabase, databaseState } from './db/copy'
import { resolveDataDir, resolveDbPath } from './db/paths'
import { messageOf } from './errors'
import secrets from './secrets'
import { copySettingsFrom, settingsState } from './settings'
import type { MigrationProgress, ProfileState } from './data-migration-plan'
import type { DataProfile } from './environment'
import type { StoreEntries } from './secrets'

const MARKER_FILE = 'data-migration.json'

interface Inspection {
   state: ProfileState
   entries: StoreEntries
}

const markerPath = () => path.join(resolveDataDir(), MARKER_FILE)

function readProgress(): MigrationProgress | null {
   try {
      const stored = JSON.parse(readFileSync(markerPath(), 'utf-8')) as Partial<MigrationProgress>

      return {
         database: stored.database === true,
         settings: stored.settings === true,
         credentials: stored.credentials === true,
         copied: Array.isArray(stored.copied) ? stored.copied : []
      }
   }
   catch {
      return null
   }
}

function writeProgress(progress: MigrationProgress): void {
   const file = markerPath()
   const temporary = `${file}.tmp`

   writeFileSync(temporary, JSON.stringify(progress, null, 3), 'utf-8')
   renameSync(temporary, file)
}

// A step already recorded is not looked at again: reading the development credential
// store can prompt, and a start should not open the development database for nothing.
async function inspect(profile: DataProfile, recorded: MigrationProgress | null): Promise<Inspection> {
   const entries = recorded?.credentials
      ? { values: new Map<string, string>(), complete: true }
      : await secrets.storeEntries(profile)

   return {
      entries,
      state: {
         database: recorded?.database ? 'missing' : databaseState(resolveDbPath(profile)),
         settings: recorded?.settings ? 'missing' : settingsState(profile),
         stored: [...entries.values.keys()]
      }
   }
}

async function step(
   name: string, progress: MigrationProgress, run: () => void | Promise<void>
): Promise<void> {

   try {
      await run()
      writeProgress(progress)
   }
   catch (error) {
      console.error(`✗ Could not migrate the ${name}, the next start tries again:`, messageOf(error))
   }
}

async function migrate(): Promise<void> {
   const recorded = readProgress()
   if (recorded && isComplete(recorded)) return

   const production = await inspect('production', recorded)

   if (!recorded && productionInUse(production.state)) {
      console.log('Production data is already in use, the development data stays where it is.')
      writeProgress({ database: true, settings: true, credentials: true, copied: [] })
      return
   }

   const development = await inspect('development', recorded)
   const plan = planDataMigration(recorded, production.state, development.state)
   const progress = recorded ?? { database: false, settings: false, credentials: false, copied: [] }

   // Written before the first copy: a start that finds production data and no marker
   // takes the data for someone else's and migrates nothing more.
   writeProgress(progress)

   await step('database', progress, () => {
      if (plan.database) {
         copyDatabase(resolveDbPath('development'), resolveDbPath('production'))
         console.log('✓ Copied the development database to', resolveDbPath('production'))
      }
      progress.database = true
   })

   await step('settings', progress, () => {
      if (plan.settings) {
         copySettingsFrom('development')
         console.log('✓ Copied the development settings')
      }
      progress.settings = true
   })

   await step('credentials', progress, async () => {
      if (progress.credentials || !production.entries.complete) return

      await secrets.adopt(new Map(plan.credentials
         .map(name => [name, development.entries.values.get(name) ?? ''])))

      if (plan.credentials.length) console.log(`✓ Copied ${plan.credentials.length} development credentials`)
      progress.copied = [...progress.copied, ...plan.credentials]
      progress.credentials = development.entries.complete
   })
}

// Copies what a release that still used the development names left under them, once.
// Nothing under a development name is changed, so an older release still finds its data.
export async function migrateDevelopmentData(): Promise<void> {
   try {
      await migrate()
   }
   catch (error) {
      console.error('✗ Could not migrate the development data, the next start tries again:', messageOf(error))
   }
}
