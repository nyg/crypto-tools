/// <reference types="bun-types" />

function run(command: string[]): string {
   try {
      const { stdout, exitCode } = Bun.spawnSync(command)
      return exitCode === 0 ? new TextDecoder().decode(stdout).trim() : ''
   } catch {
      return ''
   }
}

function regionOf(tag: string): string | undefined {
   try {
      return new Intl.Locale(tag).region
   } catch {
      return undefined
   }
}

function withRegion(languages: string[], region: string | undefined): string[] {
   if (languages.length === 0 || !region) {
      return languages
   }
   try {
      const preferred = new Intl.Locale(languages[0], { region }).toString()
      return preferred === languages[0] ? languages : [preferred, ...languages]
   } catch {
      return languages
   }
}

function macosLocales(): string[] {
   const list = run(['defaults', 'read', '-g', 'AppleLanguages'])
   const languages = list
      .slice(list.indexOf('(') + 1, list.lastIndexOf(')'))
      .split(',')
      .map(entry => entry.trim().replace(/^"|"$/g, ''))
      .filter(Boolean)

   const appleLocale = run(['defaults', 'read', '-g', 'AppleLocale'])
   const override = appleLocale.match(/@.*\brg=([A-Za-z]{2})/)?.[1]
   const region = override ?? regionOf(appleLocale.split('@')[0].replace('_', '-'))

   return withRegion(languages, region?.toUpperCase())
}

function registryValue(key: string, name: string): string {
   const line = run(['reg', 'query', key, '/v', name])
      .split(/\r?\n/)
      .find(entry => entry.trim().startsWith(name))
   const columns = line?.trim().split(/\s{2,}/) ?? []
   return columns.length >= 3 ? columns.slice(2).join(' ').trim() : ''
}

function windowsLocales(): string[] {
   const preferred = registryValue('HKCU\\Control Panel\\Desktop', 'PreferredUILanguages')
      .split('\\0')
      .map(entry => entry.trim())
      .filter(Boolean)

   const localeName = registryValue('HKCU\\Control Panel\\International', 'LocaleName')
   const languages = preferred.length ? preferred : [localeName].filter(Boolean)

   return withRegion(languages, regionOf(localeName))
}

export function systemLocales(): string[] {
   if (process.platform === 'darwin') {
      return macosLocales()
   }
   if (process.platform === 'win32') {
      return windowsLocales()
   }
   return []
}
