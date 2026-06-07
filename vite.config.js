import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
   // Relative base so assets resolve correctly under views:// (Electrobun's
   // custom scheme). Absolute /assets/... paths fail when loaded from
   // views://main/index.html because they resolve to the scheme root, not
   // views://main/assets/. Has no effect in web/dev mode.
   base: './',
   plugins: [react(), tailwindcss()],
   resolve: {
      alias: {
         '@': path.resolve(import.meta.dirname, 'src/views'),
      },
   },
   server: {
      port: 3000,
      proxy: {
         '/api': {
            target: 'http://localhost:3001',
            changeOrigin: true,
         },
      },
   },
   build: {
      outDir: 'dist',
   },
})
