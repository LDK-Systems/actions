# Check .NET Release

For new workflows, prefer [check-release-version](../check-release-version/README.md) with `version-source: dotnet`. This action remains supported for compatibility.

Read-only JavaScript action. Uses the .NET SDK to evaluate the specified project, then checks one exact GitHub release tag and the corresponding Git ref in the target repository. No release is created and no tag is pushed.

## Example

```yaml
permissions:
  contents: read

steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-dotnet@v4
    with:
      dotnet-version: '10.0.x'
  - name: Check routing release
    id: routing-release
    uses: LDK-Systems/actions/check-dotnet-release@main
    with:
      project-file: src/Routing/Routing.csproj
      configuration: Release
      release-tag-prefix: routing/v
  - name: Continue with release preparation
    if: steps.routing-release.outputs.exists == 'false' && steps.routing-release.outputs.tag-exists == 'false'
    env:
      RELEASE_TAG: ${{ steps.routing-release.outputs.tag }}
    run: printf 'New candidate: %s\n' "$RELEASE_TAG"
```

Pin the action to a reviewed commit or release in production. Use the same evaluated version/configuration/framework in your subsequent build and release steps.

## Inputs

| Input | Required | Default | Behaviour |
| --- | --- | --- | --- |
| project-file | Yes | — | Path inside the checkout to a .csproj, .fsproj or .vbproj. |
| configuration | No | Release | MSBuild Configuration property. |
| target-framework | No | — | Optional TargetFramework, e.g. net10.0, for conditional versions. |
| release-tag-prefix | No | v | Literal prefix, including any separators; pass an empty string for raw version tags. |
| repository | No | Current workflow repository | Target owner/repo (can be different if authorised). |
| token | No | github.token | Token with contents read access to target repository. |

## Outputs

| Output | Description |
| --- | --- |
| version | The effective MSBuild Version. |
| version-prefix | Effective VersionPrefix (or empty). |
| version-suffix | Effective VersionSuffix (or empty). |
| package-version | Effective PackageVersion (or empty); not used in tag construction. |
| tag | Exact candidate tag: release-tag-prefix + version. |
| exists | "true" if a matching GitHub Release is visible to this token, otherwise "false". |
| tag-exists | "true" if the exact Git tag exists, otherwise "false". |
| release-id | Release ID, or empty. |
| release-url | Release HTML URL, or empty. |
| release-name | Release display name, or empty. |
| draft | "true"/"false" if release found; otherwise empty. |
| prerelease | "true"/"false" if release found; otherwise empty. |

All outputs are strings. Check explicitly against 'true' or 'false' in workflow expressions.

## Version and tag semantics

For a project whose evaluated Version is 2.4.0-preview.1:

| Prefix | Tag |
| --- | --- |
| v (default) | v2.4.0-preview.1 |
| routing/v | routing/v2.4.0-preview.1 |
| routing- | routing-2.4.0-preview.1 |
| empty | 2.4.0-preview.1 |

Unlike check-release-version, this action does not try both raw and v-prefixed tags. It never matches another component with the same version. The version is the evaluated MSBuild property rather than a textual XML guess, so Directory.Build.props and imported/conditional settings are respected. Explicit Version wins according to MSBuild; SDK-style projects can default to 1.0.0 even without authored version metadata. Evaluation does not run a build or restore target. Versions computed by build targets (e.g. some Git-based versioning tools) require a separate version-generation step; use the version-only action if applicable. The appropriate SDK must be installed (MSBuild 17.8/SDK 8+); imported SDKs or missing generated inputs must be available.

A Git tag and a GitHub release are separate objects. A tag may exist without a release; a visible draft may exist without an actual tag. Draft visibility depends on token privileges (drafts ordinarily require push access). Read-only callers cannot guarantee the absence of an invisible draft. All unexpected API errors cause action failure rather than a false "not found". Only a 404 on the exact Git ref, after a successful release-list lookup, is interpreted as a missing tag. Concurrent release creation can occur between check and publish; enforce workflow concurrency per component/tag and re-check on publication. This action does not reserve tags.

## Security

MSBuild evaluation can load project-defined imports, SDKs and property functions; run this action only against trusted checkouts. Do not run a privileged pull_request_target workflow against untrusted PR contents. Inputs are passed as separate process arguments, not interpolated into a shell. The action uses a read-only API and masks its token. Do not supply secrets as project input or version strings.

## Development

See the root AGENTS.md. Shared MSBuild and GitHub API utilities live in packages/lib; bundle generated dist/index.js and related assets via ncc and commit them. Use Node 24-compatible hosted/self-hosted runners.
