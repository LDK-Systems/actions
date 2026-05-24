# Requirements Document

## Introduction

This feature adds release creation capability to the existing `dotnet-build` reusable workflow. After a successful build triggered by a merge to the main/default branch, the workflow will extract the project version, check if a release already exists, generate release notes from a template, and create a GitHub release. The release step only executes on merges to the main/default branch and is skipped for all other workflow triggers.

## Glossary

- **Dotnet_Build_Workflow**: The existing reusable GitHub Actions workflow (`.github/workflows/dotnet-build.yml`) that builds, tests, and optionally containerizes .NET projects.
- **Release_Job**: A new job within the Dotnet_Build_Workflow that creates a GitHub release after a successful build on the default branch.
- **Caller_Workflow**: The workflow that invokes the Dotnet_Build_Workflow via `workflow_call`.
- **Check_Release_Version_Action**: The existing JS action (`check-release-version`) that checks whether a version tag already exists as a GitHub release.
- **Generate_Release_Notes_Action**: The existing JS action (`generate-release-notes`) that renders a template and creates a GitHub release.
- **Extract_Dotnet_Version_Action**: The existing JS action (`extract-dotnet-version`) that extracts version information from `.csproj` project files.
- **Default_Branch**: The main or default branch of the calling repository (typically `main` or `master`).
- **Release_Notes_Template**: A string containing `{{key}}` placeholders that is rendered with template variables to produce the release notes body.

## Requirements

### Requirement 1: Conditional Release Execution

**User Story:** As a developer, I want the release step to only run on merges to the default branch, so that feature branches and pull requests do not create unintended releases.

#### Acceptance Criteria

1. WHEN the Dotnet_Build_Workflow is triggered by a merge to the Default_Branch and the `create-release` input is `true`, THE Release_Job SHALL execute only after the build job completes with a success status.
2. IF the `create-release` input is `false`, THEN THE Release_Job SHALL be skipped regardless of the triggering branch.
3. IF the `create-release` input is `true` and the triggering branch is not the Default_Branch, THEN THE Release_Job SHALL be skipped.
4. THE Dotnet_Build_Workflow SHALL accept a boolean input `create-release` that defaults to `false` to allow callers to opt in to release creation.
5. THE Dotnet_Build_Workflow SHALL determine the Default_Branch at runtime from the calling repository's configured default branch (e.g., `main` or `master`).

### Requirement 2: Version Extraction

**User Story:** As a developer, I want the workflow to automatically extract the version from my .NET project file, so that I do not need to manually specify the release version.

#### Acceptance Criteria

1. WHEN the Release_Job executes, THE Release_Job SHALL use the Extract_Dotnet_Version_Action to extract the version from the project file specified by the `version-source-project` input, passing it as the `project-file` input to the action.
2. THE Dotnet_Build_Workflow SHALL accept an optional string input `version-source-project` that specifies the `.csproj` file to extract the version from, defaulting to the `project-path` input value.
3. WHEN the Extract_Dotnet_Version_Action completes successfully, THE Release_Job SHALL use the action's `version` output as the release version passed to the Release workflow's `version` input.
4. IF the Extract_Dotnet_Version_Action fails to extract a version, THEN THE Release_Job SHALL fail with an error message indicating the file path that was searched and the reason no version could be resolved.
5. IF the Extract_Dotnet_Version_Action produces an empty string as the `version` output, THEN THE Release_Job SHALL fail with an error message indicating that no usable version was found in the specified project file.

### Requirement 3: Duplicate Release Prevention

**User Story:** As a developer, I want the workflow to check for existing releases before creating one, so that duplicate releases are not created for the same version.

#### Acceptance Criteria

1. WHEN the Release_Job has extracted a version, THE Release_Job SHALL invoke the Check_Release_Version_Action with the extracted version string, the target repository in owner/repo format, and a GitHub token to verify the version does not already exist as a release.
2. WHEN the Check_Release_Version_Action outputs exists as "true", THE Release_Job SHALL fail the workflow run and log an error message indicating the version already exists for the target repository.
3. WHEN the Check_Release_Version_Action outputs exists as "false", THE Release_Job SHALL proceed with release note generation.
4. IF the Check_Release_Version_Action fails due to invalid inputs or an API error, THEN THE Release_Job SHALL fail the workflow run and surface the error message provided by the action.
5. THE Check_Release_Version_Action SHALL validate that the version input is a non-empty string and that the repository input is in owner/repo format containing two non-empty segments separated by a single "/", and SHALL fail with a descriptive error message if either validation fails.

### Requirement 4: Release Notes Generation and Release Creation

**User Story:** As a developer, I want the workflow to generate release notes from a template and create a GitHub release, so that releases are consistently documented.

#### Acceptance Criteria

1. THE Dotnet_Build_Workflow SHALL accept a required string input `release-notes-template` that provides the template text for release notes when `create-release` is `true`.
2. THE Dotnet_Build_Workflow SHALL accept an optional string input `release-template-vars` that provides a JSON string of key-value pairs for template substitution, defaulting to `'{}'`.
3. WHEN the version does not already exist as a tag in the target repository, THE Release_Job SHALL invoke the Generate_Release_Notes_Action with the `release-notes-template` as the template, `release-template-vars` as the template-vars, the resolved version as the version, the calling repository as the repository, and the GitHub token for authentication.
4. WHEN the Generate_Release_Notes_Action creates a release successfully, THE Release_Job SHALL set a job output named `release-url` containing the URL of the created GitHub release.
5. IF the `release-template-vars` input is not a valid JSON object (e.g., invalid JSON syntax, a JSON array, or a primitive value), THEN THE Generate_Release_Notes_Action SHALL fail and report an error indicating the template-vars input is invalid.
6. IF the Generate_Release_Notes_Action fails, THEN THE Release_Job SHALL fail with the error message from the action.
7. WHEN the template contains `{{key}}` placeholders that have no matching key in `release-template-vars`, THE Generate_Release_Notes_Action SHALL leave those placeholders unchanged in the rendered output.

### Requirement 5: Authentication

**User Story:** As a developer, I want the workflow to use a configurable token for GitHub API operations, so that I can use either the default GITHUB_TOKEN or a custom PAT.

#### Acceptance Criteria

1. THE Release_Workflow SHALL declare an optional secret named `token` in its `workflow_call` interface for authenticating GitHub API calls made by downstream actions.
2. WHEN the `token` secret is not provided by the caller, THE Release_Job SHALL use the default `github.token` (GITHUB_TOKEN) as the authentication credential for all GitHub API operations.
3. WHEN the `token` secret is provided by the caller, THE Release_Job SHALL use the caller-provided `token` in preference over the default `github.token`.
4. THE Release_Job SHALL pass the resolved token (caller-provided `token` if supplied, otherwise `github.token`) as the `token` input to both the Check_Release_Version_Action and the Generate_Release_Notes_Action.
5. IF the resolved token lacks `contents: write` permission on the target repository, THEN THE Release_Job SHALL fail with an error message indicating insufficient permissions.

### Requirement 6: Job Dependency and Sequencing

**User Story:** As a developer, I want the release job to only run after a successful build, so that broken code is never released.

#### Acceptance Criteria

1. THE Release_Job SHALL declare a dependency on the build job using the `needs` keyword, ensuring it only runs after the build job completes with a success status.
2. IF the build job does not complete with a success status (fails, is cancelled, or is skipped), THEN THE Release_Job SHALL not execute.
3. THE Release_Job SHALL check out the actions repository (`LDK-Systems/actions`) using `actions/checkout` to make the local JS actions (check-release-version, generate-release-notes, extract-dotnet-version) available for subsequent steps.
4. IF the checkout of the actions repository fails, THEN THE Release_Job SHALL fail and not proceed to execute any subsequent steps.
