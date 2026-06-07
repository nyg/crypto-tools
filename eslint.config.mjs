import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import reactHooksPlugin from 'eslint-plugin-react-hooks'

const commonRules = {
   indent: ['error', 3, { SwitchCase: 1 }],
   semi: ['error', 'never'],
   quotes: ['error', 'single'],
}

const eslintConfig = defineConfig([
   {
      files: ['src/views/**/*.{js,jsx}'],
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
      files: ['src/server/**/*.js', 'src/utils/**/*.js'],
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
