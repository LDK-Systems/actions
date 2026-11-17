# Check Release Version

Reads an explicit version, evaluates a .NET project via MSBuild, or reads an npm package manifest. Queries GitHub Releases; never creates a release or publishes a package.

## .NET

```yaml
permissions:
  contents: read

steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-dotnet@v4
    with:
      dotnet-version: '10.0.x'
  - id: release
    uses: LDK-Systems/actions/check-release-version@main
    with:
      version-source: dotnet
      project-file: src/Routing/Routing.csproj
      release-tag-prefix: routing/v
```

Uses evaluation-time MSBuild Version, including imported Directory.Build.props and conditional properties. Requires MSBuild 17.8 / .NET SDK 8 or later; use trusted project files only. Build-target-generated versions need a separate generation step. PackageVersion is informational; tags use Version.

## npm

```yaml
steps:
  - uses: actions/checkout@v4
  - id: release
    uses: LDK-Systems/actions/check-release-version@main
    with:
      version-source: npm
      project-file: packages/ui/package.json
      release-tag-prefix: '@ldk-systems/ui@'
  - name: Continue only if neither release nor tag exists
    if: steps.release.outputs.exists == 'false' && steps.release.outputs.tag-exists == 'false'
    env:
      RELEASE_TAG: ${{ steps.release.outputs.tag }}
    run: printf 'New candidate: %s\n' "$RELEASE_TAG"
```

Reads the specified package.json version as SemVer 2.0, preserving prerelease and build metadata. Defaults to root package.json when project-file is omitted. Reads only a manifest within the checkout; no npm install, registry query, lifecycle scripts or lockfile version lookup. This is a GitHub Release check, not an npm registry publication check. Private/unpublished packages are supported.

## Explicit version (backward compatible)

```yaml
- uses: LDK-Systems/actions/check-release-version@main
  id: release
  with:
    version: '1.2.3'
    repository: ${{ github.repository }}
    token: ${{ github.token }}
```

The default version-source is explicit. In this legacy mode only exists is populated, both raw and v-prefixed tags are matched, and release-tag-prefix is not used. To check exact component tags from project files, use dotnet or npm mode.

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| version-source | explicit | explicit, dotnet, or npm |
| version | — | Required in explicit mode; not accepted in file modes |
| project-file | package.json (npm only) | Required .NET project path in dotnet mode; selected package.json in npm mode |
| configuration | Release | MSBuild Configuration (dotnet only) |
| target-framework | — | Optional MSBuild TargetFramework (dotnet only) |
| release-tag-prefix | v | Literal prefix for dotnet/npm; include any separator, or set to '' to disable |
| repository | github.repository | Target owner/repo |
| token | github.token | Token with contents read access |

## Outputs

All values are strings. The following complete contract applies to dotnet and npm modes; explicit mode retains its legacy exists-only output.

| Output | Description |
| --- | --- |
| version-source | dotnet or npm |
| version | Resolved project/package version |
| version-prefix | MSBuild VersionPrefix; empty for npm |
| version-suffix | MSBuild VersionSuffix; empty for npm |
| package-version | MSBuild PackageVersion or npm package version |
| package-name | npm package name; empty for .NET/unnamed packages |
| tag | Exact candidate prefix + version |
| exists | true if a matching GitHub Release is visible; false otherwise |
| tag-exists | true if the exact Git tag exists; false otherwise |
| release-id | Existing release ID, or empty |
| release-url | Existing release HTML URL, or empty |
| release-name | Existing release name, or empty |
| draft | Existing release draft flag, or empty |
| prerelease | Existing release prerelease flag, or empty |

Tags use the literal prefix, without automatic inference. For example routing/v + 1.2.3 becomes routing/v1.2.3; '@ldk-systems/ui@' + 3.2.1-beta.2 becomes @ldk-systems/ui@3.2.1-beta.2. A tag and release are independent; drafts may not be visible to a read-only token. API or version resolution errors fail the action rather than reporting false. This check does not reserve a version against concurrent publication. Pin the action to a reviewed revision in production.
