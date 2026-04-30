'use strict'

const { cpSync, existsSync, lstatSync, unlinkSync, readdirSync, readlinkSync } = require('fs')
const { join, resolve, dirname } = require('path')

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

// Remove dangling symlinks left by pnpm's virtual store — they cause ENOENT
// during electron-builder's codesign step.
function removeDanglingSymlinks(dir) {
   if (!existsSync(dir)) return
   for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isSymbolicLink()) {
         const target = readlinkSync(full)
         const resolved = resolve(dirname(full), target)
         if (!existsSync(resolved)) {
            unlinkSync(full)
            console.log(`Removed dangling symlink: ${full} → ${target}`)
         }
      }
      else if (entry.isDirectory()) {
         removeDanglingSymlinks(full)
      }
   }
}

removeDanglingSymlinks(join(standaloneDir, 'node_modules'))
