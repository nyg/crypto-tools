import type { DatabaseState } from './db/copy'
import type { SettingsState } from './settings'

export interface ProfileState {
   database: DatabaseState
   settings: SettingsState
   stored: string[]
}

export interface MigrationProgress {
   database: boolean
   settings: boolean
   credentials: boolean
   copied: string[]
}

export interface MigrationPlan {
   database: boolean
   settings: boolean
   credentials: string[]
}

export const isComplete = (progress: MigrationProgress): boolean =>
   progress.database && progress.settings && progress.credentials

export const productionInUse = (production: ProfileState): boolean =>
   production.database === 'data' || production.settings === 'data' || production.stored.length > 0

// The database, the account id that partitions it and the keys of that account belong
// together, so a first start that finds production in use takes nothing: filling only
// the gaps could file one account's ledger under another's id. Once a migration has
// started, each step left is decided on its own and never overwrites.
export function planDataMigration(
   progress: MigrationProgress | null, production: ProfileState, development: ProfileState
): MigrationPlan {

   if (!progress && productionInUse(production)) {
      return { database: false, settings: false, credentials: [] }
   }

   return {
      database: !progress?.database
         && development.database === 'data' && production.database !== 'data',
      settings: !progress?.settings
         && development.settings === 'data' && production.settings !== 'data',
      credentials: progress?.credentials ? [] : development.stored.filter(name =>
         !production.stored.includes(name) && !progress?.copied.includes(name))
   }
}
