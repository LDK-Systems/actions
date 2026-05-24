// eslint.config.mjs
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import jsdoc from 'eslint-plugin-jsdoc';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  // Global ignores
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '.venv/**'] },

  // Base recommended rules
  eslint.configs.recommended,

  // TypeScript-aware recommended rules
  ...tseslint.configs.recommended,

  // TypeScript files configuration for source files
  {
    files: [
      'extract-dotnet-version/src/**/*.ts',
      'check-release-version/src/**/*.ts',
      'generate-release-notes/src/**/*.ts',
      'packages/lib/src/**/*.ts',
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // TypeScript test files — no projectService needed (not in tsconfig include)
  {
    files: [
      'extract-dotnet-version/__tests__/**/*.ts',
      'check-release-version/__tests__/**/*.ts',
      'generate-release-notes/__tests__/**/*.ts',
      'packages/lib/__tests__/**/*.ts',
    ],
    languageOptions: {
      parserOptions: {
        project: null,
      },
    },
  },

  // JSDoc enforcement for src/ files only
  {
    files: [
      'extract-dotnet-version/src/**/*.ts',
      'check-release-version/src/**/*.ts',
      'generate-release-notes/src/**/*.ts',
      'packages/lib/src/**/*.ts',
    ],
    plugins: { jsdoc },
    rules: {
      'jsdoc/require-jsdoc': ['error', {
        require: { FunctionDeclaration: true, ClassDeclaration: true },
        contexts: [
          'ExportNamedDeclaration > FunctionDeclaration',
          'ExportNamedDeclaration > ClassDeclaration',
          'ExportNamedDeclaration > TSInterfaceDeclaration',
          'ExportDefaultDeclaration > FunctionDeclaration',
          'ExportDefaultDeclaration > ClassDeclaration',
        ],
        checkConstructors: false,
      }],
      'jsdoc/require-param': 'error',
      'jsdoc/require-returns': 'error',
      'jsdoc/require-description': ['error', { descriptionStyle: 'body' }],
    },
  },

  // Disable JSDoc rules for test files
  {
    files: ['**/__tests__/**/*.ts'],
    rules: {
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/require-param': 'off',
      'jsdoc/require-returns': 'off',
      'jsdoc/require-description': 'off',
    },
  },

  // Prettier compat — MUST be last
  eslintConfigPrettier,
);
