# LDK Systems Actions

Reusable GitHub Actions and workflows used across LDK Systems repositories.

This repository is an npm workspaces monorepo. Each action is written in TypeScript, shares common helpers from `packages/lib`, and is bundled with `@vercel/ncc` into `dist/index.js` for GitHub Actions to execute.

## Actions

| Action | Purpose |
| --- | --- |
| [`check-dotnet-release`](check-dotnet-release/action.yml) | Evaluates a .NET project version with MSBuild and checks the exact prefixed GitHub release and tag. |
| [`check-release-version`](check-release-version/action.yml) | Checks GitHub releases for explicit, .NET or npm versions; supports component tag prefixes. |
| [`extract-dotnet-version`](extract-dotnet-version/action.yml) | Reads version metadata from a `.csproj` file. |
| [`generate-release-notes`](generate-release-notes/action.yml) | Renders release notes from a Handlebars template and creates a GitHub release. |
| [`render-template`](render-template/action.yml) | Renders a Handlebars template and returns the rendered string. |

## Usage

Reference actions from this repository in a workflow with the action directory path:

```yaml
steps:
  - uses: actions/checkout@v4

  - name: Check release version
    id: check-version
    uses: LDK-Systems/actions/check-release-version@main
    with:
      version: 1.2.3
      repository: ${{ github.repository }}
      token: ${{ github.token }}
```

### `check-dotnet-release`

Evaluates the actual .NET project version (including imported properties) and checks GitHub Releases for a single, exact tag. Supports independent component releases in a monorepo. Requires a checked-out trusted project and the appropriate .NET SDK (MSBuild 17.8 / SDK 8 or later). Does not build or publish the project.

```yaml
permissions:
  contents: read
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-dotnet@v4
    with:
      dotnet-version: '10.0.x'
  - id: release
    uses: LDK-Systems/actions/check-dotnet-release@main
    with:
      project-file: src/Routing/Routing.csproj
      release-tag-prefix: routing/v
  - name: Continue if release does not exist
    if: steps.release.outputs.exists == 'false'
    run: echo 'Release not found'
```

See [action documentation](check-dotnet-release/README.md) for the full input/output contract, draft visibility, version evaluation, tag-only cases and concurrent release caveats. The .NET-only action remains available for compatibility; prefer the multi-source check-release-version action for new workflows.

### `check-release-version`

Select a version source with `version-source: dotnet` or `version-source: npm`. The original explicit-version mode remains the default.

```yaml
- name: Check npm package release
  id: release
  uses: LDK-Systems/actions/check-release-version@main
  with:
    version-source: npm
    project-file: packages/ui/package.json
    release-tag-prefix: 'ui/v'
```

For .NET, set `version-source: dotnet` and point `project-file` to the project (install the appropriate SDK first). Both file-based modes return exact tag, release metadata, version and separate release/tag presence flags. npm mode defaults to root package.json and does not execute npm or query the registry. See [full inputs, outputs and examples](check-release-version/README.md).

### `extract-dotnet-version`

Reads version information from a `.csproj` file. Version precedence is `Version`, then `VersionPrefix-VersionSuffix`, then `VersionPrefix`.

```yaml
- name: Extract .NET version
  id: version
  uses: LDK-Systems/actions/extract-dotnet-version@main
  with:
    project-file: src/MyProject/MyProject.csproj
```

Inputs:

| Name | Required | Description |
| --- | --- | --- |
| `project-file` | Yes | Path to the `.csproj` file. |

Outputs:

| Name | Description |
| --- | --- |
| `version` | Resolved version string. |
| `version-prefix` | Value from `VersionPrefix`, or an empty string. |
| `version-suffix` | Value from `VersionSuffix`, or an empty string. |

### `generate-release-notes`

Renders a Handlebars template and creates a GitHub release using the rendered body.

Template source precedence is:

1. `template`
2. `template-file`
3. Bundled default template

Variables come from `template-vars` and `RELEASE_VAR_*` environment variables. Values in `template-vars` take precedence over matching environment variables.

```yaml
- name: Generate release notes
  id: release
  uses: LDK-Systems/actions/generate-release-notes@main
  with:
    version: 1.2.3
    repository: ${{ github.repository }}
    token: ${{ github.token }}
    template: |
      ## Release {{version}}

      {{summary}}
    template-vars: '{"version":"1.2.3","summary":"Bug fixes and small improvements."}'
```

Inputs:

| Name | Required | Description |
| --- | --- | --- |
| `template` | No | Inline Handlebars template. Takes precedence over `template-file`. |
| `template-file` | No | Path to a Handlebars template file. |
| `template-vars` | No | JSON object of variables for template rendering. Defaults to `{}`. |
| `version` | Yes | Release tag and release name. |
| `repository` | Yes | Target repository in `owner/repo` format. |
| `token` | No | GitHub token for API authentication. Defaults to `GITHUB_TOKEN` when available. |

Outputs:

| Name | Description |
| --- | --- |
| `release-url` | URL of the created GitHub release. |
| `release-notes` | Rendered release notes body. |

### `render-template`

Renders an inline or file-based Handlebars template and returns the rendered result.

```yaml
- name: Render template
  id: template
  uses: LDK-Systems/actions/render-template@main
  with:
    template: 'Hello {{name}}'
    template-vars: '{"name":"LDK"}'
```

Inputs:

| Name | Required | Description |
| --- | --- | --- |
| `template` | No | Inline Handlebars template. Takes precedence over `template-file`. |
| `template-file` | No | Path to a Handlebars template file. |
| `template-vars` | No | JSON object of variables for template rendering. Defaults to `{}`. Values may be strings, arrays, or nested objects. |

Outputs:

| Name | Description |
| --- | --- |
| `result` | Rendered template output. |

## Template Syntax

Template-based actions use Handlebars and support interpolation, conditionals, list iteration, nested objects, and comparison helpers:

```hbs
{{#if (eq environment "production")}}
Deploying {{version}} to production
{{/if}}

{{#each changes}}
- {{this}}
{{/each}}
```

Available comparison helpers are `eq`, `ne`, `gt`, `gte`, `lt`, and `lte`.

## Reusable Workflows

Reusable workflows live in [`.github/workflows`](.github/workflows):

| Workflow | Purpose |
| --- | --- |
| [`release.yml`](.github/workflows/release.yml) | Checks for an existing version, creates release notes, creates the release, and optionally uploads release artifacts. |
| [`dotnet-build.yml`](.github/workflows/dotnet-build.yml) | Restores, builds, and tests .NET projects, with optional Docker image build/push and artifact upload. |

## Development

Install [Volta](https://volta.sh/) first. The root package.json pins Node.js 24.22.3 and npm 11.19.1. All JavaScript workspaces inherit those pins via volta.extends; the GitHub runner's action runtime is set to `node24` in each JavaScript action's `runs.using`. CI installs the same toolchain using volta-cli/action.

Install dependencies:

```bash
npm ci
```

Run tests:

```bash
npm test
```

Run a focused test project:

```bash
npx vitest run --project render-template
```

Build all actions:

```bash
npm run build
```

Type-check and lint:

```bash
npm run typecheck
npm run lint
```

Each action is bundled into `dist/index.js`, which is the entrypoint declared in `action.yml`. After changing source in an action or in `packages/lib`, run `npm run build` and commit the updated `dist/` output.

Tests live in each workspace's `__tests__/` directory and import from `src/` directly. Property-based tests use `fast-check` and follow the `*.property.test.ts` naming pattern.

### Change-aware CI

CI runs for pull requests targeting main and for every push to main, including merged PRs. The changes job discovers registered root-level JavaScript action workspaces, generates filters, and uses dorny/paths-filter to return a JSON array of affected actions. For PRs changes are compared to the PR base; for main pushes they are compared with the pre-push revision (so multi-commit pushes are covered).

| Change | Build matrix |
| --- | --- |
| `check-dotnet-release/**` | check-dotnet-release |
| Two action directories | Both actions, in separate jobs |
| `packages/**` (shared library) | All actions |
| Root package/lock/Volta/config or CI build scripts | All actions |
| Unrelated documentation only | No action build |

Each matrix job uses the pinned toolchain, performs a clean ncc build for its one selected workspace, rejects any changes to committed dist, then uploads the bundle as a short-lived CI artifact. CI never pushes generated files or creates releases. Quality and full Vitest coverage run once when any action is affected; live .NET and npm smoke tests run when the relevant release checker is affected. The stable CI result job can be configured in branch protection; an empty matrix is a successful no-op.

To rebuild one action locally:

```bash
npm run clean:dist -- check-dotnet-release
npm run build --workspace check-dotnet-release
git add check-dotnet-release/dist
git commit -m "build: regenerate action distribution"
npm run check:dist -- check-dotnet-release
```

Run `npm run test:ci-tools` to validate the workspace discovery and filter-generation helpers. A new JavaScript action is automatically included when its root-level directory has action metadata with a Node runtime and a private package with a build script registered in root workspaces. Update tests/typecheck/lint configuration as appropriate.

### Dependency security

Keep `npm audit --audit-level=moderate` passing. Upgrade direct dependencies intentionally, review `package-lock.json`, and rebuild all committed distributions after dependency changes. Vitest 5 uses `test.projects` in the root `vitest.config.ts` and a matching V8 coverage provider. TypeScript retains ES imports for ncc to bundle ESM dependencies into the standalone action entrypoints.
