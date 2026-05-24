# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm ci

# Build all actions (bundles each to dist/index.js via ncc)
npm run build

# Run all tests across all workspaces
npm test

# Run tests with coverage (80% line coverage threshold per workspace)
npm run test:coverage

# Run a single workspace's tests
npx vitest run --project check-release-version
npx vitest run --project extract-dotnet-version
npx vitest run --project generate-release-notes
npx vitest run --project packages/lib

# Type-check all workspaces
npm run typecheck

# Lint
npm run lint
npm run lint:fix

# Format
npm run format:check
npm run format
```

## Architecture

This is an npm workspaces monorepo of GitHub Actions and reusable workflows targeting Node 20.

### Workspaces

- **`packages/lib`** — shared internal library (private, not published). Exports XML parsing (`fast-xml-parser`), GitHub API helpers (`@actions/github`), and Handlebars template rendering. Consumed by actions via workspace path alias `@ldk-systems/lib`.
- **`extract-dotnet-version`** — reads a `.csproj` file and outputs `version`, `version-prefix`, `version-suffix` using precedence rules (`Version` > `VersionPrefix-VersionSuffix` > `VersionPrefix`).
- **`check-release-version`** — queries the GitHub Releases API and outputs `exists: true/false`. Matches both raw and `v`-prefixed tag forms (e.g. `1.0.0` and `v1.0.0`).
- **`generate-release-notes`** — renders a Handlebars template (inline, file, or bundled default) with merged variables from `template-vars` input and `RELEASE_VAR_*` env vars, then creates a GitHub release.
- **`render-template`** — renders a Handlebars template (inline or file) with variables from `template-vars` and outputs the result string. Supports comparison helpers (`eq`, `ne`, `gt`, `gte`, `lt`, `lte`) and list iteration (`{{#each}}`); `template-vars` values may be strings, arrays, or objects.

### Build pipeline

Each action is bundled with `@vercel/ncc` into a single `dist/index.js` file — this is the file GitHub Actions executes (`runs.main: dist/index.js`). The `dist/` directory is committed. After changing source in any action or `packages/lib`, run `npm run build` and commit the updated `dist/`.

### Reusable workflows

- `.github/workflows/release.yml` — `workflow_call` wrapper that orchestrates `check-release-version` → `generate-release-notes` → artifact upload.
- `.github/workflows/dotnet-build.yml` — `workflow_call` wrapper for .NET restore/build/test, optional Docker image build/push, and artifact upload. Uses `extract-dotnet-version` internally for Docker image tagging.

### Tests

Tests live in `__tests__/` alongside each workspace. Vitest is used with `fast-check` for property-based tests (files named `*.property.test.ts`). Tests import from `src/` directly; they do not go through `dist/`.

## Code conventions

- JSDoc is **required** on all exported functions, classes, and interfaces in `src/` files (enforced by ESLint). Tests are exempt.
- Prettier: 100-char line width, 2-space indent, single quotes, trailing commas, semicolons.
- `src/` files use TypeScript project references (`tsconfig.json` per workspace extends `tsconfig.base.json`). Test files intentionally sit outside `tsconfig include` and are compiled by Vitest's own transform.
