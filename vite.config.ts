import { readFileSync } from 'fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const { version } = JSON.parse(
   readFileSync(path.resolve(import.meta.dirname, 'package.json'), 'utf-8')) as { version: string }

export default defineConfig({
   define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
   },
   // Relative base so assets resolve correctly under views:// (Electrobun's
   // custom scheme). Absolute /assets/... paths fail when loaded from
   // views://main/index.html because they resolve to the scheme root, not
   // views://main/assets/. Dev is unaffected, but a deep link in the web build
   // resolves them against the route instead of the root, which the production
   // server in src/server/index.js compensates for.
   base: './',
   plugins: [react(), tailwindcss()],
   resolve: {
      alias: {
         '@': path.resolve(import.meta.dirname, 'src/views'),
      },
   },
   server: {
      port: Number(process.env.VITE_PORT ?? 3000),
      strictPort: true,
      proxy: {
         '/api': {
            target: `http://localhost:${process.env.PORT ?? 3001}`,
            changeOrigin: true,
         },
      },
   },
   build: {
      outDir: 'dist',
   },
})
