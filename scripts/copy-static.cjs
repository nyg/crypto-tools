'use strict'

const { cpSync, existsSync } = require('fs')
const { join } = require('path')

const root = join(__dirname, '..')
const standaloneDir = join(root, '.next', 'standalone')

const copies = [
   { from: join(root, '.next', 'static'),  to: join(standaloneDir, '.next', 'static') },
   { from: join(root, 'public'),           to: join(standaloneDir, 'public') },
]

for (const { from, to } of copies) {
   if (existsSync(from)) {
      cpSync(from, to, { recursive: true })
      console.log(`Copied: ${from} → ${to}`)
   } else {
      console.warn(`Skipped (not found): ${from}`)
   }
}
