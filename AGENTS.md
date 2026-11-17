# AGENTS.md

This file provides guidance to coding agents working in this repository.

## Quick reference

- Read [README.md](README.md) for repository overview and [CLAUDE.md](CLAUDE.md) for the detailed command references.
- Install dependencies with `npm ci`.
- Build all actions with `npm run build`.
- Run the full test suite with `npm test`.
- Run coverage with `npm run test:coverage`.
- Run focused tests with `npx vitest run --project <workspace>`.
- Run type-checking with `npm run typecheck`.
- Run linting with `npm run lint`.

## Architecture

- This is an npm workspaces monorepo for GitHub Actions and reusable workflows.
- `packages/lib` is the shared internal library used by all actions.
- Each action lives in its own workspace under `check-release-version/`, `extract-dotnet-version/`, `generate-release-notes/`, `render-template/`, and `check-dotnet-release/`.
- Each action is bundled into `dist/index.js` with `@vercel/ncc`, and GitHub Actions executes that bundled file from `runs.main` in the corresponding `action.yml`.
- When changing source in an action or in `packages/lib`, rebuild before committing so `dist/` stays up to date.

## Development conventions

- Add JSDoc to exported functions, interfaces, and classes in `src/` files.
- Keep changes consistent with existing TypeScript, Prettier, and ESLint settings.
- Prefer adding reusable logic to `packages/lib` instead of duplicating it across actions.
- Tests live in `__tests__/` next to each workspace and import from `src/` directly.
- Property-based tests use `fast-check` and should follow the existing `*.property.test.ts` naming pattern.

## Practical workflow

1. Inspect the existing action `action.yml` and the relevant `src/` code before making changes.
2. Update or add tests first when changing behavior.
3. Run the targeted Vitest project for the affected workspace.
4. Run `npm run build` and `npm run typecheck` if the change affects action entrypoints, shared library behavior, or typings.
5. Only touch `dist/` as part of a build step or when explicitly required by the repository workflow.

## Distribution and release checks

- JavaScript actions MUST be authored in TypeScript and compiled with ncc. Commit the complete generated action dist directory, including required assets and licence notices. Never hand-edit generated JavaScript; rebuilding must not produce a diff. Type checking must not emit into dist. Run `npm run build` and `npm run check:dist` against the committed result.
- Keep `packages/lib` private and bundle its code into each consumer action. Do not publish it to npm. Add new actions to workspaces, the lockfile, test configuration, and lint scopes.
- Evaluate .NET `Version` via MSBuild where effective project version is needed, rather than parsing only a .csproj. Require a trusted checked-out project and SDK 8+. Never interpolate inputs in shell commands. Use `check-dotnet-release` for prefix-aware exact tag checks; distinguish a Git tag from a GitHub Release. A release lookup is not a lock or an instruction to create/release anything.
- Use explicit inputs and outputs, read-only API permissions for lookup, and propagate authentication, permission and network errors. Do not report such failures as a missing release.
