import { base, react, typescript } from '@nyg/eslint-config'
import { defineConfig } from 'eslint/config'

const views = react.map(config => ({ ...config, files: ['src/views/**/*.{ts,tsx}', 'src/utils/**/*.ts'] }))

export default defineConfig([base, typescript, views])
