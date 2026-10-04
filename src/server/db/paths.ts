import { existsSync, mkdirSync, renameSync, statSync } from 'fs'
import os from 'os'
import path from 'path'
import { dataProfile } from '../environment'
import { messageOf } from '../errors'
import type { DataProfile } from '../environment'

// macOS and Windows name application data folders after the app as the user sees it;
// the XDG spec wants a lowercase, machine-readable name. Both used to be 'CryptoTools',
// which LEGACY_DIR_NAME migrates away from.
const APP_DIR_NAME = process.platform === 'linux' ? 'crypto-tools' : 'Crypto Tools'
const LEGACY_DIR_NAME = 'CryptoTools'

// The desktop app is launched from Finder, where process.cwd() is '/'. Anything
// resolved relative to the working directory would end up unwritable, so the
// database always lives in the OS' per-user application data directory.
function osDataDirIn(name: string): string {
   if (process.platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', name)
   }
   if (process.platform === 'win32') {
      const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
      return path.join(appData, name)
   }
   const dataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share')
   return path.join(dataHome, name)
}

// Move the pre-rename data directory across, so an upgrade keeps the synced ledger
// instead of silently starting from an empty database. Returns the directory to use:
// the legacy one if it exists but could not be moved (read-only parent, open handle,
// separate volume) — losing the data would be worse than an unfashionable path.
function migrateLegacyDir(dir: string): string {
   const legacy = osDataDirIn(LEGACY_DIR_NAME)
   if (legacy === dir || existsSync(dir) || !existsSync(legacy)) {
      return dir
   }
   try {
      renameSync(legacy, dir)
      return dir
   }
   catch (error) {
      console.warn(`Could not move ${legacy} to ${dir}, keeping the old location:`, messageOf(error))
      return legacy
   }
}

export function resolveDataDir(): string {
   const dir = process.env.CRYPTO_TOOLS_DATA_DIR
      ? path.resolve(process.env.CRYPTO_TOOLS_DATA_DIR)
      : migrateLegacyDir(osDataDirIn(APP_DIR_NAME))

   mkdirSync(dir, { recursive: true })
   return dir
}

const DATABASE_NAMES: Record<DataProfile, string> = {
   production: 'ledger.db',
   development: 'ledger-dev.db'
}

// Separate file names so `bun run dev` never writes into the installed app's data. The
// entry point picks the profile with useProductionData(): NODE_ENV cannot, because the
// desktop bundler inlines it as 'development' in a released build too.
export function resolveDbPath(profile: DataProfile = dataProfile()): string {
   return path.join(resolveDataDir(), DATABASE_NAMES[profile])
}

export function dbSizeBytes(): number {
   const dbPath = resolveDbPath()
   return [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]
      .reduce((total, file) => total + (existsSync(file) ? statSync(file).size : 0), 0)
}
