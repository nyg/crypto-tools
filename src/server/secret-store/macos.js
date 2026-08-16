import { existsSync } from 'fs'

const SECURITY = '/usr/bin/security'
const ITEM_NOT_FOUND = 44
const AVAILABILITY_PROBE = 'availability-probe'

const encode = text => new TextEncoder().encode(text)

const withConfirmation = value => `${value}\n${value}\n`

function run(args, input) {
   const result = Bun.spawnSync([SECURITY, ...args], {
      stdin: input === undefined ? 'ignore' : encode(input),
      stdout: 'pipe',
      stderr: 'ignore'
   })

   return { code: result.exitCode, output: result.stdout.toString() }
}

export default function macosStore(service) {

   const read = name => {
      const { code, output } = run(['find-generic-password', '-s', service, '-a', name, '-w'])

      if (code === ITEM_NOT_FOUND) return null
      if (code !== 0) throw new Error(`security find-generic-password exited with ${code} for ${name}`)

      return output.replace(/\n$/, '')
   }

   return {
      id: 'keychain',

      available() {
         if (!existsSync(SECURITY)) return false
         try {
            return run(['find-generic-password', '-s', service, '-a', AVAILABILITY_PROBE]).code === ITEM_NOT_FOUND
         }
         catch {
            return false
         }
      },

      read,

      write(name, value) {
         run(['add-generic-password', '-U', '-s', service, '-a', name, '-w'], withConfirmation(value))
         return read(name) === value
      },

      remove(name) {
         const { code } = run(['delete-generic-password', '-s', service, '-a', name])
         return code === 0 || code === ITEM_NOT_FOUND
      }
   }
}
