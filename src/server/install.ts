import { existsSync } from 'fs'
import path from 'path'
import type { InstallInfo, InstallPlatform } from '../types/api'

const CASK_TOKEN = 'crypto-tools'
const SCOOP_APPS_PATH = /[\\/]scoop[\\/]apps[\\/]/i
const HOMEBREW_PREFIXES = ['/opt/homebrew', '/usr/local']

function currentPlatform(): InstallPlatform {
   if (process.platform === 'darwin') return 'macos'
   if (process.platform === 'win32') return 'windows'
   if (process.platform === 'linux') return 'linux'
   return 'other'
}

function hasHomebrewCask(): boolean {
   return [process.env.HOMEBREW_PREFIX, ...HOMEBREW_PREFIXES]
      .filter((prefix): prefix is string => Boolean(prefix))
      .some(prefix => existsSync(path.join(prefix, 'Caskroom', CASK_TOKEN)))
}

// Both signals are guesses, and both fail down to 'manual' rather than to a command
// that would not work: telling someone to run brew upgrade on a copy Homebrew has
// never seen is worse than telling them to download the new one.
function detect(desktop: boolean): InstallInfo {
   const platform = currentPlatform()

   if (!desktop) return { platform, method: 'web' }
   if (platform === 'windows' && SCOOP_APPS_PATH.test(process.execPath)) {
      return { platform, method: 'scoop' }
   }
   if (platform === 'macos' && hasHomebrewCask()) {
      return { platform, method: 'homebrew' }
   }

   return { platform, method: 'manual' }
}

let cached: InstallInfo | null = null

export function installInfo(desktop: boolean): InstallInfo {
   if (!cached) cached = detect(desktop)
   return cached
}
