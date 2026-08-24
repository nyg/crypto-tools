import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

const commonRules = {
   indent: ['error', 3, { SwitchCase: 1 }],
   semi: ['error', 'never'],
   quotes: ['error', 'single'],
   '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
   }],
}

const typescriptConfigs = tseslint.configs.recommended.map(config => ({
   ...config,
   files: ['src/**/*.{js,jsx,ts,tsx}'],
}))

const eslintConfig = defineConfig([
   ...typescriptConfigs,
   {
      files: ['src/views/**/*.{js,jsx,ts,tsx}'],
      plugins: {
         'react-hooks': reactHooksPlugin,
      },
      languageOptions: {
         globals: globals.browser,
         parserOptions: {
            ecmaFeatures: { jsx: true },
         },
      },
      rules: {
         ...reactHooksPlugin.configs.recommended.rules,
         'react-hooks/exhaustive-deps': 'off',
         ...commonRules,
      },
   },
   {
      files: ['src/server/**/*.{js,ts}', 'src/utils/**/*.{js,ts}'],
      languageOptions: {
         globals: globals.node,
      },
      rules: commonRules,
   },
   {
      files: ['src/electrobun/**/*.ts'],
      languageOptions: {
         globals: globals.node,
      },
      rules: commonRules,
   },
   globalIgnores([
      'dist/**',
      'node_modules/**',
   ]),
])

export default eslintConfig
