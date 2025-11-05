import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
    ],
    rules: {
      // Configurações para melhor suporte a Unicode/UTF-8
      'no-irregular-whitespace': 'off', // Permite espaços especiais
      'no-misleading-character-class': 'off', // Permite caracteres especiais em regex

      // Regras específicas para emojis e símbolos
      'no-unused-vars': ['warn', {
        varsIgnorePattern: '^(ICONS|EMOJIS|UI_TEXT|CLOSED|OPEN|HALF_OPEN)$',
        argsIgnorePattern: '^_'
      }],

      // Permite strings com caracteres especiais
      'quotes': ['error', 'single', {
        avoidEscape: true,
        allowTemplateLiterals: true
      }],
    },
  },
];

export default eslintConfig;
