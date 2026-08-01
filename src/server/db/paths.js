import { existsSync, mkdirSync, statSync } from 'fs'
import os from 'os'
import path from 'path'

const APP_DIR_NAME = 'CryptoTools'

// The desktop app is launched from Finder, where process.cwd() is '/'. Anything
// resolved relative to the working directory would end up unwritable, so the
// database always lives in the OS' per-user application data directory.
function osDataDir() {
   if (process.platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', APP_DIR_NAME)
   }
   if (process.platform === 'win32') {
      const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
      return path.join(appData, APP_DIR_NAME)
   }
   const dataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share')
   return path.join(dataHome, APP_DIR_NAME)
}

export function resolveDataDir() {
   const dir = process.env.CRYPTO_TOOLS_DATA_DIR
      ? path.resolve(process.env.CRYPTO_TOOLS_DATA_DIR)
      : osDataDir()

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
