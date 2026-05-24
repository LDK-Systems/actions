# Implementation Plan: GitHub Actions Monorepo

## Overview

This plan implements the LDK-Systems GitHub Actions monorepo from the ground up. The approach builds foundational infrastructure first (workspace config, shared library), then dependent components (JS actions, workflows), and finally wires everything together with tests and build verification. Each task is independently verifiable and builds incrementally on prior work.

## Tasks

- [x] 1. Set up repository scaffolding and workspace configuration
  - [x] 1.1 Create root package.json with npm workspace configuration
    - Create `package.json` at repository root with name `@ldk-systems/actions`, `private: true`, workspaces array including `extract-dotnet-version`, `check-release-version`, `generate-release-notes`, and `packages/*`
    - Add root scripts: `build`, `test`, `test:coverage`, `typecheck`
    - Add devDependencies: `@vercel/ncc`, `typescript`, `vitest`, `@vitest/coverage-v8`
    - _Requirements: 1.5, 6.3, 9.1_

  - [x] 1.2 Create base TypeScript configuration
    - Create `tsconfig.base.json` at repository root with target ES2022, module commonjs, strict mode, esModuleInterop, skipLibCheck, declaration, sourceMap
    - _Requirements: 6.5_

  - [x] 1.3 Create Vitest workspace configuration
    - Create `vitest.workspace.ts` at repository root defining workspace members: `packages/lib`, `extract-dotnet-version`, `check-release-version`, `generate-release-notes`
    - _Requirements: 7.1, 7.2_

- [x] 2. Implement shared library (`@ldk-systems/lib`)
  - [x] 2.1 Create shared library package structure
    - Create `packages/lib/package.json` with name `@ldk-systems/lib`, private, main and types pointing to `src/index.ts`
    - Add dependencies: `@actions/core`, `@actions/github`, `fast-xml-parser`
    - Create `packages/lib/tsconfig.json` extending `../../tsconfig.base.json`
    - Create `packages/lib/vitest.config.ts` with v8 coverage provider and 80% line threshold
    - _Requirements: 5.1, 5.2, 9.2_

  - [x] 2.2 Implement XML parsing module
    - Create `packages/lib/src/xml.ts` with `parseXmlDocument` and `parseXmlElement` functions using `fast-xml-parser`
    - `parseXmlDocument` parses XML string and returns document object, throws on invalid XML
    - `parseXmlElement` extracts text content of a specific element by tag name, returns `undefined` if not found
    - _Requirements: 5.4, 5.8_

  - [x] 2.3 Implement GitHub API module
    - Create `packages/lib/src/github-api.ts` with `getReleases` and `releaseExists` functions using `@actions/github` (Octokit)
    - `getReleases` fetches all releases for a repository, throws on auth/network errors
    - `releaseExists` checks both raw version and v-prefixed version against release tags
    - _Requirements: 5.5, 5.8_

  - [x] 2.4 Implement release creation module
    - Create `packages/lib/src/releases.ts` with `createRelease` function
    - Accepts token, owner, repo, tag, name, body, optional draft/prerelease flags
    - Returns release id, url, and htmlUrl
    - Throws on API errors
    - _Requirements: 5.6, 5.8_

  - [x] 2.5 Implement template rendering module
    - Create `packages/lib/src/template.ts` with `renderTemplate` function
    - Replaces `{{key}}` placeholders with values from variables object
    - Leaves unmatched placeholders unchanged in output
    - _Requirements: 5.7, 5.8_

  - [x] 2.6 Create shared library entry point
    - Create `packages/lib/src/index.ts` re-exporting all named exports from `xml`, `github-api`, `releases`, and `template` modules
    - _Requirements: 5.2, 13.5_

  - [x] 2.7 Write unit tests for XML parsing module
    - Create `packages/lib/__tests__/xml.test.ts`
    - Test: parsing valid XML returns correct document object
    - Test: extracting existing element returns text content
    - Test: extracting non-existing element returns undefined
    - Test: invalid XML throws error
    - _Requirements: 7.6_

  - [x] 2.8 Write unit tests for GitHub API module
    - Create `packages/lib/__tests__/github-api.test.ts`
    - Test: getReleases returns release list with mocked Octokit
    - Test: releaseExists returns true when tag matches
    - Test: releaseExists returns true when v-prefixed tag matches
    - Test: releaseExists returns false when no match
    - Test: API errors propagate correctly
    - Mock `@actions/github.getOctokit`
    - _Requirements: 7.6, 7.7_

  - [x] 2.9 Write unit tests for release creation module
    - Create `packages/lib/__tests__/releases.test.ts`
    - Test: createRelease calls Octokit with correct parameters
    - Test: createRelease returns id, url, htmlUrl from response
    - Test: API errors propagate correctly
    - Mock `@actions/github.getOctokit`
    - _Requirements: 7.6, 7.7_

  - [x] 2.10 Write unit tests for template rendering module
    - Create `packages/lib/__tests__/template.test.ts`
    - Test: replaces single placeholder
    - Test: replaces multiple placeholders
    - Test: leaves unmatched placeholders unchanged
    - Test: handles empty template
    - Test: handles empty variables object
    - _Requirements: 7.6_

  - [x] 2.11 Write property test for XML element extraction
    - **Property 2: XML element extraction returns correct text content**
    - Generate random well-formed XML documents and tag names using fast-check
    - Verify parseXmlElement returns correct text content for existing elements and undefined for non-existing
    - **Validates: Requirements 5.4**

  - [x] 2.12 Write property test for template rendering
    - **Property 3: Template rendering substitution correctness**
    - Generate random template strings with `{{key}}` placeholders and random variable maps using fast-check
    - Verify all matched placeholders are replaced, unmatched remain, and non-placeholder text is preserved
    - **Validates: Requirements 5.7, 12.1, 12.8**

- [x] 3. Checkpoint - Verify shared library
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement extract-dotnet-version action
  - [x] 4.1 Create action package structure
    - Create `extract-dotnet-version/package.json` with name `@ldk-systems/extract-dotnet-version`, private, build script `ncc build src/index.ts -o dist --source-map --license licenses.txt`
    - Add dependencies: `@actions/core`, `@ldk-systems/lib`
    - Create `extract-dotnet-version/tsconfig.json` extending `../tsconfig.base.json`
    - Create `extract-dotnet-version/vitest.config.ts`
    - _Requirements: 1.2, 6.2, 9.3, 9.6_

  - [x] 4.2 Create action.yml metadata file
    - Create `extract-dotnet-version/action.yml` with name, description, `project-file` required input, outputs `version`, `version-prefix`, `version-suffix`, runs using `node20` with main `dist/index.js`
    - _Requirements: 2.8, 1.2_

  - [x] 4.3 Implement action entry point
    - Create `extract-dotnet-version/src/index.ts`
    - Read `project-file` input, read file with `fs.readFileSync`
    - Import `parseXmlElement` from `@ldk-systems/lib`
    - Extract `Version`, `VersionPrefix`, `VersionSuffix` elements
    - Apply precedence: Version > VersionPrefix-VersionSuffix > VersionPrefix alone
    - Set outputs via `core.setOutput`
    - Handle errors: file not found, invalid XML, no version info → `core.setFailed`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 13.4_

  - [x] 4.4 Write unit tests for extract-dotnet-version
    - Create `extract-dotnet-version/__tests__/index.test.ts`
    - Test: extracts `<Version>` element correctly
    - Test: constructs version from `<VersionPrefix>` and `<VersionSuffix>`
    - Test: extracts `<VersionPrefix>` alone as version
    - Test: `<Version>` takes precedence over prefix/suffix
    - Test: fails when file does not exist
    - Test: fails when no version properties present
    - Test: fails on invalid XML
    - Mock `fs.readFileSync` and `@actions/core`
    - _Requirements: 7.4, 7.7_

  - [x] 4.5 Write property test for version extraction precedence
    - **Property 1: Version extraction applies correct precedence rules**
    - Generate random .csproj XML with various combinations of Version, VersionPrefix, VersionSuffix elements using fast-check
    - Verify precedence rules: Version > Prefix-Suffix > Prefix alone
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [x] 5. Implement check-release-version action
  - [x] 5.1 Create action package structure
    - Create `check-release-version/package.json` with name `@ldk-systems/check-release-version`, private, build script
    - Add dependencies: `@actions/core`, `@ldk-systems/lib`
    - Create `check-release-version/tsconfig.json` extending `../tsconfig.base.json`
    - Create `check-release-version/vitest.config.ts`
    - _Requirements: 1.2, 6.2, 9.4, 9.6_

  - [x] 5.2 Create action.yml metadata file
    - Create `check-release-version/action.yml` with `version` (required), `repository` (required), `token` (optional) inputs, `exists` output, runs using `node20` with main `dist/index.js`
    - _Requirements: 3.7, 1.2_

  - [x] 5.3 Implement action entry point
    - Create `check-release-version/src/index.ts`
    - Read inputs: `version`, `repository`, `token` (fallback to `GITHUB_TOKEN` env var)
    - Validate: version non-empty, repository in `owner/repo` format
    - Import `releaseExists` from `@ldk-systems/lib`
    - Call `releaseExists` and set `exists` output
    - Handle errors: invalid input, API failures → `core.setFailed`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 13.3_

  - [x] 5.4 Write unit tests for check-release-version
    - Create `check-release-version/__tests__/index.test.ts`
    - Test: outputs `true` when release exists
    - Test: outputs `false` when release does not exist
    - Test: handles version with and without `v` prefix
    - Test: fails on empty version input
    - Test: fails on invalid repository format
    - Test: fails on GitHub API errors
    - Mock `@actions/github` and `@actions/core`
    - _Requirements: 7.5, 7.7_

  - [x] 5.5 Write property test for release existence detection
    - **Property 4: Release existence detection correctness**
    - Generate random version strings and sets of release tags using fast-check
    - Verify releaseExists returns true iff tag set contains exact version or v-prefixed version
    - **Validates: Requirements 3.2, 3.3**

  - [x] 5.6 Write property test for repository input validation
    - **Property 5: Repository input format validation**
    - Generate random strings (both valid `owner/repo` and invalid formats) using fast-check
    - Verify invalid formats cause validation failure, valid formats pass validation
    - **Validates: Requirements 3.4, 12.6**

- [x] 6. Implement generate-release-notes action
  - [x] 6.1 Create action package structure
    - Create `generate-release-notes/package.json` with name `@ldk-systems/generate-release-notes`, private, build script
    - Add dependencies: `@actions/core`, `@ldk-systems/lib`
    - Create `generate-release-notes/tsconfig.json` extending `../tsconfig.base.json`
    - Create `generate-release-notes/vitest.config.ts`
    - _Requirements: 1.2, 6.2, 9.5, 9.6_

  - [x] 6.2 Create action.yml metadata file
    - Create `generate-release-notes/action.yml` with `template` (required), `template-vars` (required), `version` (required), `repository` (required), `token` (optional) inputs, `release-url` output, runs using `node20` with main `dist/index.js`
    - _Requirements: 12.10, 1.2_

  - [x] 6.3 Implement action entry point
    - Create `generate-release-notes/src/index.ts`
    - Read inputs: `template`, `template-vars`, `version`, `repository`, `token` (fallback to `GITHUB_TOKEN`)
    - Validate: version non-empty, repository in `owner/repo` format, template-vars is valid JSON object
    - Import `renderTemplate` and `createRelease` from `@ldk-systems/lib`
    - Render template with parsed variables
    - Create release with rendered body, version as tag and name
    - Set `release-url` output
    - Handle errors: invalid inputs, JSON parse errors, API failures → `core.setFailed`
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 13.2_

  - [x] 6.4 Write unit tests for generate-release-notes
    - Create `generate-release-notes/__tests__/index.test.ts`
    - Test: renders template and creates release with correct parameters
    - Test: outputs release-url from API response
    - Test: fails on empty version
    - Test: fails on invalid repository format
    - Test: fails on invalid JSON in template-vars
    - Test: fails on non-object JSON (array, string, number, null)
    - Test: fails on GitHub API error
    - Test: leaves unmatched placeholders unchanged
    - Mock `@actions/github` and `@actions/core`
    - _Requirements: 7.8, 7.7_

  - [x] 6.5 Write property test for template variables JSON validation
    - **Property 6: Template variables JSON validation**
    - Generate random strings including valid JSON objects, invalid JSON, arrays, strings, numbers, booleans, null using fast-check
    - Verify non-object values cause validation failure, valid objects pass
    - **Validates: Requirements 12.5**

- [x] 7. Checkpoint - Verify all actions
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Create reusable workflows
  - [x] 8.1 Create .NET build reusable workflow
    - Create `.github/workflows/dotnet-build.yml` with `workflow_call` trigger
    - Define inputs: `dotnet-version` (required), `project-path` (required), `configuration` (optional, default `Release`), `run-tests` (optional boolean, default `true`), `build-docker-image` (optional boolean, default `false`), `docker-image-name` (optional), `dockerfile-path` (optional, default `./Dockerfile`), `docker-build-args` (optional)
    - Implement job steps: setup-dotnet → cache NuGet (key from `**/*.csproj` and `**/Directory.Packages.props` hashes) → dotnet restore → dotnet build → conditional dotnet test → conditional Docker build with BuildKit cache
    - Validate `docker-image-name` is provided when `build-docker-image` is true
    - Use `if: success()` for sequential failure propagation
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12, 4.13, 4.14, 4.15, 4.16, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 8.2 Create release reusable workflow
    - Create `.github/workflows/release.yml` with `workflow_call` trigger
    - Define inputs: `version` (required), `release-notes-template` (required), `template-vars` (optional, default `{}`)
    - Define secrets: `token` (optional)
    - Implement job steps: checkout actions repo → run check-release-version action → conditional generate-release-notes action (only if version does not exist)
    - Fail workflow if version already exists
    - Use caller's `github.repository` context for release target
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10_

  - [x] 8.3 Create CI workflow
    - Create `.github/workflows/ci.yml` triggered on `pull_request` to `main`
    - Implement test job: cache npm (key from `package-lock.json` hash) → `npm ci` → `vitest run --coverage`
    - Implement build job: `npm ci` → `npm run build` (all actions)
    - Build job runs conditionally when action source or lib files change
    - Report results as GitHub check on PR
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 10.1, 10.4, 10.5, 10.6_

- [x] 9. Build and verify all actions
  - [x] 9.1 Build all JS actions with ncc
    - Run `npm run build` at root to compile all actions
    - Verify each action produces `dist/index.js` in its directory
    - Verify the shared library code is inlined (no external `node_modules` needed at runtime)
    - _Requirements: 6.1, 6.3, 6.4, 6.6, 1.3_

  - [x] 9.2 Verify workspace dependency resolution
    - Confirm `@ldk-systems/lib` is resolved correctly by each action's build
    - Confirm ncc bundles shared library code into each action's dist output
    - _Requirements: 5.3, 13.1, 13.6_

- [x] 10. Checkpoint - Verify base implementation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Upgrade template rendering to Handlebars
  - [x] 11.1 Add Handlebars dependency and update template module
    - Add `handlebars` package as a dependency in `packages/lib/package.json`
    - Rewrite `packages/lib/src/template.ts` to use Handlebars for template compilation and rendering
    - Support full Handlebars syntax: `{{variable}}` interpolation, `{{#if}}` conditionals, `{{#each}}` iteration
    - Maintain backward compatibility: unmatched placeholders remain unchanged (use Handlebars `noEscape` or custom helper)
    - Export `renderTemplate` with same signature: `(template: string, variables: Record<string, string>) => string`
    - _Requirements: 5.7, 12.4, 12.16_

  - [x] 11.2 Update template unit tests for Handlebars syntax
    - Update `packages/lib/__tests__/template.test.ts`
    - Test: renders `{{variable}}` placeholders correctly
    - Test: renders `{{#if}}` conditionals
    - Test: renders `{{#each}}` iteration
    - Test: leaves unmatched variables unchanged
    - Test: handles empty template and empty variables
    - Test: throws on invalid Handlebars syntax (template compilation error)
    - _Requirements: 7.6, 12.4, 12.14_

  - [x] 11.3 Update property test for Handlebars template rendering
    - Update property test to account for Handlebars syntax
    - Verify `{{variable}}` substitution correctness still holds
    - **Property 3: Template rendering substitution correctness**
    - **Validates: Requirements 5.7, 12.1, 12.4**

- [x] 12. Enhance generate-release-notes action
  - [x] 12.1 Add template-file input, default template, and RELEASE_VAR_ support
    - Update `generate-release-notes/action.yml` to add `template-file` optional input, make `template` optional, and add `release-notes` output
    - Create a default template file bundled within the `generate-release-notes/` directory
    - Update `generate-release-notes/src/index.ts`:
      - Implement template source precedence: inline `template` > `template-file` > default bundled template
      - Read template from file path when `template-file` is provided (fail if file not found)
      - Collect environment variables prefixed with `RELEASE_VAR_`, strip prefix, use remainder as key
      - Merge variables: `template-vars` input takes precedence over `RELEASE_VAR_` env vars for same key
      - Add `release-notes` output containing the rendered release notes body
      - Handle Handlebars template syntax errors with descriptive failure message
    - _Requirements: 12.1, 12.2, 12.3, 12.5, 12.6, 12.7, 12.9, 12.10, 12.13, 12.14, 12.17, 12.18_

  - [x] 12.2 Update generate-release-notes unit tests
    - Update `generate-release-notes/__tests__/index.test.ts`
    - Test: uses inline `template` input when provided (precedence over template-file)
    - Test: reads template from `template-file` path when no inline template
    - Test: uses default bundled template when neither template nor template-file provided
    - Test: fails when `template-file` path does not exist
    - Test: collects `RELEASE_VAR_` environment variables as template variables
    - Test: `template-vars` input takes precedence over `RELEASE_VAR_` env vars for same key
    - Test: outputs `release-notes` containing rendered body
    - Test: fails on Handlebars template syntax errors
    - Mock `fs`, `@actions/core`, `@actions/github`, and `process.env`
    - _Requirements: 7.8, 7.7, 12.2, 12.3, 12.6, 12.7, 12.10, 12.13, 12.14_

- [x] 13. Checkpoint - Verify template and action enhancements
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Enhance .NET build workflow with Docker push, multi-platform, and artifacts
  - [x] 14.1 Add Docker push, registry auth, and multi-platform inputs
    - Update `.github/workflows/dotnet-build.yml` to add inputs:
      - `docker-push` (optional string) — push only when value is `push`
      - `registry-url` (optional string) — remote Docker registry URL
      - `docker-platforms` (optional string) — comma-separated platform architectures
      - `upload-artifacts` (optional boolean, default `false`)
      - `artifact-name` (optional string, default derived from project name)
      - `artifact-path` (optional string) — file paths/glob patterns to upload
    - Add secrets: `registry-username`, `registry-password`
    - _Requirements: 4.17, 4.18, 4.19, 4.20, 4.24, 4.30, 4.31, 4.32_

  - [x] 14.2 Implement QEMU, Buildx multi-platform, and registry login steps
    - Add QEMU setup step (`docker/setup-qemu-action`) conditional on `docker-platforms` including non-host architectures
    - Update Buildx setup to run before Docker build when `build-docker-image` is true
    - Add `docker/login-action` step for registry authentication when `docker-push` is `push`
    - Pass `docker-platforms` to `docker/build-push-action` platforms parameter
    - Validate: fail if `docker-push` is `push` but `registry-url`, `registry-username`, or `registry-password` are missing
    - _Requirements: 4.21, 4.22, 4.23, 4.25, 4.26, 4.27_

  - [x] 14.3 Implement version extraction for Docker and push logic
    - Add step to invoke `extract-dotnet-version` action using `project-path` input before Docker build
    - Inject extracted version as `VERSION` build argument into Docker build command automatically
    - Set `push: true` in `docker/build-push-action` when `docker-push` is `push` and registry auth succeeds
    - _Requirements: 4.28, 4.29_

  - [x] 14.4 Implement artifact upload steps
    - Add artifact upload step using `actions/upload-artifact@v4` conditional on `upload-artifacts` is `true` and build succeeds
    - Upload files matching `artifact-path` with name `artifact-name`
    - Validate: fail if `upload-artifacts` is `true` but `artifact-path` is not provided
    - _Requirements: 4.30, 4.33, 4.34_

- [x] 15. Enhance release workflow with artifacts support
  - [x] 15.1 Add artifacts input and conditional upload to release workflow
    - Update `.github/workflows/release.yml` to add `artifacts` optional input (file paths/glob patterns)
    - When `artifacts` is provided and current branch is `main`, upload matching files as assets to the created GitHub release
    - When `artifacts` is provided and current branch is not `main`, skip artifact attachment
    - _Requirements: 11.11, 11.12, 11.13_

- [x] 16. Rebuild all actions and final verification
  - [x] 16.1 Rebuild all JS actions with ncc
    - Run `npm run build` at root to recompile all actions with updated shared library (Handlebars) and action changes
    - Verify each action produces updated `dist/index.js`
    - Verify Handlebars library is inlined into generate-release-notes dist output
    - _Requirements: 6.1, 6.3, 6.4, 5.3_

  - [x] 16.2 Verify all workspace dependencies resolve correctly
    - Confirm `handlebars` is bundled into generate-release-notes via ncc
    - Confirm no runtime `node_modules` required for any action
    - _Requirements: 5.3, 6.1, 13.1_

- [x] 17. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All tests use mocked dependencies (fs, Octokit, @actions/core) — no live API calls
- The build system uses `@vercel/ncc` to produce self-contained `dist/index.js` files for each action
- TypeScript is the implementation language throughout (specified in design)
- Tasks 1–10 are already complete (base implementation); tasks 11–17 address remaining requirements gaps

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["11.1"] },
    { "id": 1, "tasks": ["11.2", "11.3"] },
    { "id": 2, "tasks": ["12.1"] },
    { "id": 3, "tasks": ["12.2", "14.1"] },
    { "id": 4, "tasks": ["14.2", "14.3", "14.4", "15.1"] },
    { "id": 5, "tasks": ["16.1"] },
    { "id": 6, "tasks": ["16.2"] }
  ]
}
```
