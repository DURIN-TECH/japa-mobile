import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prettier from 'eslint-plugin-prettier';
import react from 'eslint-plugin-react';
import _import from 'eslint-plugin-import';
import { fixupPluginRules } from '@eslint/compat';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: [
      'dist/*',
      'node_modules/*',
      'package.json',
      'package-lock.json',
      '*.json',
      '*.md',
      'tailwind.config.js',
    ],
  },
  ...compat.extends(
    'plugin:prettier/recommended',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ),
  {
    plugins: {
      prettier,
      react,
      import: fixupPluginRules(_import),
    },

    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly',
      },

      parser: tsParser,
      ecmaVersion: 2020,
      sourceType: 'module',

      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },

    rules: {
      'prettier/prettier': 'error',

      'import/order': [
        'error',
        {
          pathGroupsExcludedImportTypes: ['react'],
        },
      ],

      'react/jsx-curly-brace-presence': [
        'error',
        {
          props: 'never',
          children: 'ignore',
        },
      ],
    },
  },
];
