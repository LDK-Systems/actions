# LDK Systems Actions

Reusable GitHub Actions and workflows used across LDK Systems repositories.

This repository is an npm workspaces monorepo. Each action is written in TypeScript, shares common helpers from `packages/lib`, and is bundled with `@vercel/ncc` into `dist/index.js` for GitHub Actions to execute.

## Actions

| Action | Purpose |
| --- | --- |
| [`check-release-version`](check-release-version/action.yml) | Checks whether a GitHub release already exists for a version. |
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

### `check-release-version`

Checks GitHub Releases for an existing version and outputs `exists` as `true` or `false`.

```yaml
- name: Check release version
  id: check-version
  uses: LDK-Systems/actions/check-release-version@main
  with:
    version: 1.2.3
    repository: ${{ github.repository }}
    token: ${{ github.token }}
```

Inputs:

| Name | Required | Description |
| --- | --- | --- |
| `version` | Yes | Version string to check. Raw and `v`-prefixed tags are matched. |
| `repository` | Yes | Repository in `owner/repo` format. |
| `token` | No | GitHub token for API authentication. Defaults to `GITHUB_TOKEN` when available. |

Outputs:

| Name | Description |
| --- | --- |
| `exists` | Whether the release version already exists. |

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
