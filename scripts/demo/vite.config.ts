import path from 'path'
import { readFileSync } from 'fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const repo = path.resolve(import.meta.dirname, '../..')
const video = process.env.DEMO_VIDEO ?? ''
const mock = path.resolve(import.meta.dirname, 'videos', video, 'mock.ts')

const { version } = JSON.parse(readFileSync(path.resolve(repo, 'package.json'), 'utf-8')) as { version: string }

export default defineConfig({
   root: repo,
   define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
   },
   base: './',
   plugins: [
      {
         name: 'demo-mock',
         enforce: 'pre',
         resolveId(source, importer) {
            if (source === './portfolio' && importer?.endsWith('/src/views/mocks/index.ts')) return mock
            return undefined
         }
      },
      react(),
      tailwindcss()
   ],
   resolve: {
      alias: {
         '@': path.resolve(repo, 'src/views'),
      },
   },
   server: {
      port: Number(process.env.DEMO_PORT ?? 3100),
      strictPort: true,
      fs: { allow: [repo] }
   },
})
