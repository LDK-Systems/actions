# Implementation Plan: ESLint & Prettier Integration

## Overview

This plan integrates ESLint and Prettier into the monorepo through root-level configuration files, npm scripts, and CI workflow updates. The implementation order ensures dependencies are available before configs are created, configs exist before scripts reference them, and all code passes checks before CI enforcement is added.

## Tasks

- [x] 1. Install devDependencies and create configuration files
  - [x] 1.1 Add ESLint and Prettier devDependencies to root package.json
    - Add `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`, `eslint-plugin-jsdoc`, and `prettier` as devDependencies in the root `package.json`
    - Use versions: eslint ^9.0.0, @eslint/js ^9.0.0, typescript-eslint ^8.0.0, eslint-config-prettier ^10.0.0, eslint-plugin-jsdoc ^50.0.0, prettier ^3.0.0
    - Run `npm install` to update `package-lock.json`
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 1.2 Create ESLint flat config file (`eslint.config.mjs`)
    - Create `eslint.config.mjs` at the monorepo root using `tseslint.config()` helper
    - Configure global ignores for `dist/`, `node_modules/`, `coverage/`
    - Extend `eslint.configs.recommended` and `tseslint.configs.recommended`
    - Add TypeScript files configuration with `projectService: true` targeting all workspace `src/` and `__tests__/` directories
    - Add JSDoc enforcement block for `src/` files only (require-jsdoc on exported functions, classes, interfaces; require-param; require-returns; require-description)
    - Add JSDoc disable block for `__tests__/` files
    - Add `eslintConfigPrettier` as the last entry in the config array
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 1.3 Create Prettier configuration files (`.prettierrc` and `.prettierignore`)
    - Create `.prettierrc` at the monorepo root with: printWidth 100, tabWidth 2, useTabs false, semi true, singleQuote true, trailingComma all, bracketSpacing true, arrowParens always
    - Create `.prettierignore` at the monorepo root excluding `dist/`, `node_modules/`, `package-lock.json`, `coverage/`
    - _Requirements: 2.1, 2.3_

- [x] 2. Add npm scripts and update CI workflow
  - [x] 2.1 Add lint and format scripts to root package.json
    - Add `"lint": "eslint ."` script
    - Add `"lint:fix": "eslint . --fix"` script
    - Add `"format": "prettier --write \"**/*.ts\""` script
    - Add `"format:check": "prettier --check \"**/*.ts\""` script
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 2.2 Update `.github/workflows/ci.yml` with quality job and coverage artifacts
    - Add a new `quality` job that runs before `test` and `build` with steps: checkout, setup-node, cache, npm ci, `npm run lint`, `npm run format:check`, `npm audit --audit-level=moderate`
    - Add `needs: [quality]` to both the `test` and `build` jobs
    - Update the `test` job to upload coverage artifacts using `actions/upload-artifact@v4` with `name: coverage-report`, `path: coverage/`, `retention-days: 30`, and `if: always()` condition
    - Ensure the test step generates coverage in both JSON summary and HTML formats
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 3. Checkpoint - Verify configuration loads correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Fix existing code to pass lint and format checks
  - [x] 4.1 Run Prettier to auto-format all TypeScript files
    - Run `npm run format` to rewrite all `.ts` files to match the configured Prettier style
    - Verify with `npm run format:check` that all files now conform (exit code 0)
    - _Requirements: 2.2, 2.4, 2.5, 5.7, 5.8_

  - [x] 4.2 Fix ESLint violations in source files
    - Run `npm run lint:fix` to auto-fix any fixable ESLint violations
    - Manually fix any remaining violations (e.g., add missing JSDoc comments to exported functions/classes/interfaces in `src/` directories)
    - Ensure all exported functions have `@param` tags for each parameter and `@returns` tags for non-void return types
    - Ensure all JSDoc blocks have a non-empty description
    - _Requirements: 1.6, 4.1, 4.2, 4.3, 4.4, 4.5, 5.5, 5.6, 5.9_

  - [x] 4.3 Verify no conflicts between ESLint and Prettier
    - Run `npm run format` followed by `npm run lint` and confirm both exit with code 0
    - This validates that `eslint-config-prettier` correctly disables conflicting rules
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 5. Final checkpoint - End-to-end verification
  - Run `npm run lint`, `npm run format:check`, and `npm run test` in sequence to confirm all pass cleanly. Ensure all tests pass, ask the user if questions arise.

## Notes

- This feature produces only configuration files and CI workflow changes — no custom application code
- Property-based tests are not applicable (no custom functions or algorithms)
- All behavior comes from third-party tools (ESLint, Prettier) reading configuration
- The primary verification is running the tools and confirming exit codes
- JSDoc enforcement applies only to `src/` directories, not `__tests__/`
- `eslint-config-prettier` must always be the last entry in the ESLint config array to prevent conflicts

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1", "2.2"] },
    { "id": 3, "tasks": ["4.1"] },
    { "id": 4, "tasks": ["4.2"] },
    { "id": 5, "tasks": ["4.3"] }
  ]
}
```
