import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  {
    ignores: ['node_modules/**', '.next/**', 'coverage/**', 'cypress/videos/**', 'cypress/screenshots/**'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  ...compat.extends('plugin:cypress/recommended').map((config) => ({
    ...config,
    files: ['cypress/**/*.{js,ts,tsx}', 'cypress.config.ts'],
  })),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      'react/no-unescaped-entities': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'prefer-const': 'warn',
    },
  },
];
