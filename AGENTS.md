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
- Each action lives in its own workspace under `check-release-version/`, `extract-dotnet-version/`, `generate-release-notes/`, and `render-template/`.
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
