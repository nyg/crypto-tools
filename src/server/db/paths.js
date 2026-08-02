import { existsSync, mkdirSync, renameSync, statSync } from 'fs'
import os from 'os'
import path from 'path'

// macOS and Windows name application data folders after the app as the user sees it;
// the XDG spec wants a lowercase, machine-readable name. Both used to be 'CryptoTools',
// which LEGACY_DIR_NAME migrates away from.
const APP_DIR_NAME = process.platform === 'linux' ? 'crypto-tools' : 'Crypto Tools'
const LEGACY_DIR_NAME = 'CryptoTools'

// The desktop app is launched from Finder, where process.cwd() is '/'. Anything
// resolved relative to the working directory would end up unwritable, so the
// database always lives in the OS' per-user application data directory.
function osDataDirIn(name) {
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
function migrateLegacyDir(dir) {
   const legacy = osDataDirIn(LEGACY_DIR_NAME)
   if (legacy === dir || existsSync(dir) || !existsSync(legacy)) {
      return dir
   }
   try {
      renameSync(legacy, dir)
      return dir
   }
   catch (error) {
      console.warn(`Could not move ${legacy} to ${dir}, keeping the old location:`, error.message)
      return legacy
   }
}

export function resolveDataDir() {
   const dir = process.env.CRYPTO_TOOLS_DATA_DIR
      ? path.resolve(process.env.CRYPTO_TOOLS_DATA_DIR)
      : migrateLegacyDir(osDataDirIn(APP_DIR_NAME))

   mkdirSync(dir, { recursive: true })
   return dir
}

// Separate file names so `bun run dev` never writes into the installed app's data.
export function resolveDbPath() {
   const name = process.env.NODE_ENV === 'production' ? 'ledger.db' : 'ledger-dev.db'
   return path.join(resolveDataDir(), name)
}

export function dbSizeBytes() {
   const dbPath = resolveDbPath()
   return [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]
      .reduce((total, file) => total + (existsSync(file) ? statSync(file).size : 0), 0)
}
