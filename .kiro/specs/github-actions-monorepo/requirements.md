# Requirements Document

## Introduction

This document defines the requirements for the LDK-Systems GitHub Actions monorepo. The repository serves as the centralised source of reusable GitHub Actions workflows, composite actions, and JavaScript actions for all repositories within the LDK-Systems GitHub organisation. The monorepo follows GitHub's recommended structure for hosting multiple actions and workflows in a single repository, with shared libraries built using @vercel/ncc and a testing framework for quality assurance.

## Glossary

- **Actions_Monorepo**: The GitHub repository at `LDK-Systems/actions` that contains all shared workflows, composite actions, and JavaScript actions for the organisation
- **JS_Action**: A GitHub Action implemented in JavaScript/TypeScript using the @actions/core toolkit, compiled into a single distributable file using @vercel/ncc
- **Reusable_Workflow**: A GitHub Actions workflow defined with `workflow_call` trigger that can be referenced from other repositories' workflows
- **Composite_Action**: A GitHub Action defined using a sequence of steps in an action.yml file without requiring a runtime
- **NCC_Bundler**: The @vercel/ncc compiler that bundles a Node.js project into a single file with all dependencies included
- **Shared_Library**: A common JavaScript/TypeScript package within the monorepo that provides reusable utilities to JS actions, scoped under @ldk-systems/
- **Version_Extractor**: A JS action that parses .NET project files (.csproj) to extract version information
- **Release_Checker**: A JS action that queries GitHub releases to determine if a specific version tag already exists
- **Release_Creator**: A JS action that creates a GitHub release with templated release notes using configurable input parameters
- **DotNet_Build_Workflow**: A parameterised reusable workflow for building .NET projects with configurable options including optional Docker image building
- **Docker_Image_Build**: An optional stage within the DotNet_Build_Workflow that builds a Docker container image from the .NET project output
- **Docker_Registry**: A remote container image registry (such as Docker Hub, GitHub Container Registry, or Amazon ECR) to which built Docker images are pushed
- **QEMU_Emulator**: The QEMU user-space emulation layer configured via `docker/setup-qemu-action` that enables building Docker images for architectures different from the host runner
- **Buildx_Builder**: A Docker buildx builder instance created via `docker/setup-buildx-action` that supports multi-platform builds and layer caching via the GitHub Actions cache backend
- **Release_Workflow**: A reusable workflow that creates a new release version with templated release notes when changes are merged to the main branch
- **CI_Workflow**: The continuous integration workflow for the actions monorepo itself that runs tests on pull requests
- **Action_Metadata**: The action.yml file that defines an action's inputs, outputs, and runtime configuration
- **Dependency_Cache**: A mechanism using GitHub Actions cache to store and restore package manager dependencies (npm, NuGet) and Docker layers between workflow runs
- **Release_Notes_Template**: A Handlebars template containing variable placeholders and control flow syntax that is compiled and rendered with input parameters to produce formatted release notes

## Requirements

### Requirement 1: Repository Structure

**User Story:** As a developer in the LDK-Systems organisation, I want the actions monorepo to follow GitHub's recommended layout, so that actions and workflows are discoverable and correctly referenced from other repositories.

#### Acceptance Criteria

1. THE Actions_Monorepo SHALL organise reusable workflows in the `.github/workflows/` directory
2. THE Actions_Monorepo SHALL organise each JS action in its own directory at the repository root with a dedicated `action.yml` Action_Metadata file that specifies `node20` as the runtime and references `dist/index.js` as the entry point
3. THE Actions_Monorepo SHALL include a `dist/` folder within each JS action directory containing the NCC_Bundler output, and this folder SHALL be committed to version control
4. THE Actions_Monorepo SHALL organise the Shared_Library as an internal package in a `packages/lib/` directory with the scope prefix `@ldk-systems/`
5. THE Actions_Monorepo SHALL use a root `package.json` configured as an npm workspace with workspace members including each JS action directory at the repository root and the `packages/*` directory

### Requirement 2: .NET Version Extraction Action

**User Story:** As a CI pipeline author, I want a JS action that extracts version information from .NET project files, so that I can use the version in downstream workflow steps such as tagging and releasing.

#### Acceptance Criteria

1. WHEN a `.csproj` file path is provided via the `project-file` input, THE Version_Extractor SHALL parse the file and set the outputs `version`, `version-prefix`, and `version-suffix` to the corresponding values found in the file, or to an empty string for any property not present
2. WHEN the `.csproj` file contains both a `<Version>` element and `<VersionPrefix>` or `<VersionSuffix>` elements, THE Version_Extractor SHALL use the `<Version>` element value as the `version` output, taking precedence over constructed values
3. WHEN the `.csproj` file contains `<VersionPrefix>` and `<VersionSuffix>` elements but no `<Version>` element, THE Version_Extractor SHALL construct the `version` output as `{VersionPrefix}-{VersionSuffix}`
4. WHEN the `.csproj` file contains `<VersionPrefix>` without a `<VersionSuffix>` and no `<Version>` element, THE Version_Extractor SHALL output the `version-prefix` value as the `version` output
5. IF the specified `.csproj` file does not exist, THEN THE Version_Extractor SHALL fail the action with an error message indicating the file path could not be found, and this check SHALL take precedence over any subsequent parsing or version validation checks
6. IF the `.csproj` file contains none of `<Version>`, `<VersionPrefix>`, or `<VersionSuffix>` elements, THEN THE Version_Extractor SHALL fail the action with an error message indicating no version information was found
7. IF the `.csproj` file cannot be parsed as valid XML, THEN THE Version_Extractor SHALL fail the action with an error message indicating the file is not valid XML
8. THE Version_Extractor SHALL define its inputs and outputs in an Action_Metadata file specifying `node20` as the runtime, with `project-file` as a required input and `version`, `version-prefix`, and `version-suffix` as outputs

### Requirement 3: Release Version Check Action

**User Story:** As a CI pipeline author, I want a JS action that checks whether a version already exists as a GitHub release, so that I can prevent duplicate releases and make conditional release decisions.

#### Acceptance Criteria

1. WHEN a version string and repository name (in `owner/repo` format) are provided as inputs, THE Release_Checker SHALL query the GitHub Releases API for the target repository
2. WHEN a release with a tag matching either the provided version or the provided version prefixed with `v` exists, THE Release_Checker SHALL output `exists` as `true`
3. WHEN no release with a tag matching either the provided version or the provided version prefixed with `v` exists, THE Release_Checker SHALL output `exists` as `false`
4. IF the version input is empty or the repository input is not in `owner/repo` format, THEN THE Release_Checker SHALL validate inputs immediately before any API authentication or connection setup and fail the action with an error message indicating the first invalid input detected
5. IF the GitHub API request fails due to authentication errors, network errors, or the repository not being found, THEN THE Release_Checker SHALL fail the action with an error message indicating the cause of failure
6. THE Release_Checker SHALL authenticate using the GitHub token provided via the `token` input, falling back to the default `GITHUB_TOKEN` environment variable when no explicit input is provided, and SHALL allow the action to proceed to the API request even if no token validation is performed upfront
7. THE Release_Checker SHALL define its inputs and outputs in an Action_Metadata file specifying `node20` as the runtime

### Requirement 4: Reusable .NET Build Workflow

**User Story:** As a developer in the LDK-Systems organisation, I want a parameterised reusable workflow for building .NET projects with optional Docker image building, so that all repositories follow a consistent build and containerisation process without duplicating workflow definitions.

#### Acceptance Criteria

1. THE DotNet_Build_Workflow SHALL accept a required `dotnet-version` input parameter specifying the .NET SDK version to install
2. THE DotNet_Build_Workflow SHALL accept a required `project-path` input parameter specifying the relative path to the .NET solution or project file
3. THE DotNet_Build_Workflow SHALL accept an optional `configuration` input parameter with a default value of `Release`
4. THE DotNet_Build_Workflow SHALL accept an optional `run-tests` input parameter (boolean) with a default value of `true`
5. WHEN the workflow is triggered, THE DotNet_Build_Workflow SHALL execute `dotnet restore`, `dotnet build`, and conditionally `dotnet test` as sequential steps in that order, passing the `configuration` parameter to each command
6. WHEN `run-tests` is `true` and the build step succeeds, THE DotNet_Build_Workflow SHALL execute `dotnet test` using the same `configuration` and `project-path` parameters
7. THE DotNet_Build_Workflow SHALL be defined with a `workflow_call` trigger so that other repositories can reference it
8. IF the restore step fails, THEN THE DotNet_Build_Workflow SHALL fail the workflow job and not proceed to the build step
9. IF the build step fails, THEN THE DotNet_Build_Workflow SHALL fail the workflow job with the build output available in the workflow logs and not proceed to the test step
10. IF the test step fails, THEN THE DotNet_Build_Workflow SHALL fail the workflow job with the test output available in the workflow logs
11. THE DotNet_Build_Workflow SHALL accept an optional `build-docker-image` input parameter (boolean) with a default value of `false`
12. THE DotNet_Build_Workflow SHALL accept an optional `docker-image-name` input parameter specifying the fully qualified image name including registry and repository path
13. THE DotNet_Build_Workflow SHALL accept an optional `dockerfile-path` input parameter specifying the relative path to the Dockerfile, with a default value of `./Dockerfile`
14. WHEN `build-docker-image` is `true` and the build step succeeds, THE DotNet_Build_Workflow SHALL execute a Docker image build step using the specified `dockerfile-path` and tag the image with the `docker-image-name` parameter
15. WHEN `build-docker-image` is `true`, THE DotNet_Build_Workflow SHALL accept an optional `docker-build-args` input parameter for passing additional build arguments to the Docker build command
16. IF `build-docker-image` is `true` and `docker-image-name` is not provided, THEN THE DotNet_Build_Workflow SHALL fail the workflow job with an error message indicating the image name is required when Docker building is enabled
17. THE DotNet_Build_Workflow SHALL accept an optional `docker-push` input parameter (string) that controls whether the built Docker image is pushed to a remote registry; pushing SHALL only occur when this input is set to the value `push`
18. THE DotNet_Build_Workflow SHALL accept an optional `registry-url` input parameter specifying the remote Docker_Registry URL to push images to
19. THE DotNet_Build_Workflow SHALL accept a `registry-username` secret input for authenticating with the Docker_Registry
20. THE DotNet_Build_Workflow SHALL accept a `registry-password` secret input for authenticating with the Docker_Registry
21. WHEN `docker-push` is set to `push` and the Docker image build succeeds, THE DotNet_Build_Workflow SHALL authenticate with the Docker_Registry using `docker/login-action` with the provided `registry-url`, `registry-username`, and `registry-password` before pushing the image
22. WHEN `docker-push` is set to `push` and registry authentication succeeds, THE DotNet_Build_Workflow SHALL push the built Docker image to the Docker_Registry specified by `registry-url`
23. IF `docker-push` is set to `push` and any of `registry-url`, `registry-username`, or `registry-password` are not provided, THEN THE DotNet_Build_Workflow SHALL fail the workflow job with an error message indicating the missing registry credentials
24. THE DotNet_Build_Workflow SHALL accept an optional `docker-platforms` input parameter specifying a comma-separated list of target platform architectures for the Docker image build
25. WHEN `build-docker-image` is `true` and `docker-platforms` includes architectures different from the host runner, THE DotNet_Build_Workflow SHALL configure the QEMU_Emulator using `docker/setup-qemu-action` before the Docker build step
26. WHEN `build-docker-image` is `true`, THE DotNet_Build_Workflow SHALL set up the Buildx_Builder using `docker/setup-buildx-action` before any Docker build step to enable multi-platform builds and cache reuse
27. WHEN `docker-platforms` is provided, THE DotNet_Build_Workflow SHALL pass the platform list to the Docker build command so that images are built for all specified architectures
28. WHEN `build-docker-image` is `true`, THE DotNet_Build_Workflow SHALL invoke the Version_Extractor action using the `project-path` input to extract the project version from the .csproj file, and SHALL inject the extracted version as a `VERSION` build argument into the Docker build command automatically
29. THE DotNet_Build_Workflow SHALL execute the version extraction step before the Docker build step so that the VERSION build argument is available during image construction
30. THE DotNet_Build_Workflow SHALL accept an optional `upload-artifacts` input parameter (boolean) with a default value of `false`
31. THE DotNet_Build_Workflow SHALL accept an optional `artifact-name` input parameter specifying the name for the uploaded artifact bundle, with a default value derived from the project name
32. THE DotNet_Build_Workflow SHALL accept an optional `artifact-path` input parameter specifying the file paths or glob patterns of build outputs to upload as artifacts
33. WHEN `upload-artifacts` is `true` and the build step succeeds, THE DotNet_Build_Workflow SHALL upload the files matching `artifact-path` as a workflow artifact using the `artifact-name` value
34. IF `upload-artifacts` is `true` and `artifact-path` is not provided, THEN THE DotNet_Build_Workflow SHALL fail the workflow job with an error message indicating the artifact path is required when artifact upload is enabled

### Requirement 5: Shared JavaScript Library

**User Story:** As a JS action developer, I want a shared library of common utilities, so that I can reuse code across multiple actions without duplication.

#### Acceptance Criteria

1. THE Shared_Library SHALL be published as an internal workspace package named `@ldk-systems/lib`
2. THE Shared_Library SHALL expose its utility functions as named exports from the package entry point, importable by JS actions within the monorepo
3. WHEN a JS action imports from the Shared_Library, THE NCC_Bundler SHALL inline the shared code into the action's `dist/` output, and IF the bundler fails to inline the shared code THEN the build SHALL fail with a non-zero exit code
4. THE Shared_Library SHALL include XML parsing utilities capable of extracting element text content by tag name from well-formed XML documents, usable by the Version_Extractor
5. THE Shared_Library SHALL include GitHub API helper utilities capable of querying releases for a given repository using an authentication token, usable by the Release_Checker
6. THE Shared_Library SHALL include GitHub release creation utilities capable of creating a release with a tag, name, and body content using an authentication token, usable by the Release_Creator
7. THE Shared_Library SHALL include Handlebars-based template rendering utilities capable of compiling and rendering Handlebars templates with provided variable objects, supporting standard Handlebars syntax including variable interpolation, conditionals, and iteration, usable by the Release_Creator
8. IF a Shared_Library utility function encounters an error during execution, THEN THE Shared_Library SHALL propagate the error to the calling action rather than returning a silent fallback value

### Requirement 6: JavaScript Action Build System

**User Story:** As a JS action developer, I want each action to be compiled with @vercel/ncc, so that actions are self-contained and do not require `node_modules` at runtime.

#### Acceptance Criteria

1. THE NCC_Bundler SHALL compile each JS action's source code and dependencies into a single file named `index.js` in the action's `dist/` directory
2. THE Actions_Monorepo SHALL provide a build script in each JS action's `package.json` that invokes the NCC_Bundler with `src/index.ts` as the entry point
3. THE Actions_Monorepo SHALL provide a root-level build script that compiles all JS actions in sequence
4. WHEN the Shared_Library source changes, THE NCC_Bundler SHALL include the updated Shared_Library code in subsequent action builds
5. THE Actions_Monorepo SHALL use TypeScript as the source language for JS actions and the Shared_Library
6. IF the NCC_Bundler compilation fails for any action, THEN the build script SHALL exit with a non-zero status code and output the compilation error including any warnings produced during compilation
7. WHEN the NCC_Bundler compilation succeeds for all actions and all actions are actually compiled, THE build script SHALL exit with a zero status code

### Requirement 7: Testing Framework

**User Story:** As a JS action developer, I want a testing framework configured for the monorepo, so that I can write and run unit tests for actions and the shared library.

#### Acceptance Criteria

1. THE Actions_Monorepo SHALL use a JavaScript testing framework compatible with TypeScript and npm workspaces to execute unit tests for JS actions and the Shared_Library
2. THE Actions_Monorepo SHALL provide a root-level `test` script in the root `package.json` that discovers and runs all tests across the workspace packages
3. WHEN tests are executed, THE testing framework SHALL generate a coverage report with a minimum line coverage threshold of 80%, and SHALL fail the build if coverage calculation produces invalid results
4. THE Version_Extractor SHALL have unit tests that verify parsing of a `<Version>` element, construction of version from `<VersionPrefix>` and `<VersionSuffix>`, extraction of `<VersionPrefix>` alone, failure on a missing file, and failure when no version properties are present
5. THE Release_Checker SHALL have unit tests that verify identification of an existing release, identification of a non-existing release, handling of version tags with and without a `v` prefix, and failure on GitHub API errors, using mocked HTTP responses instead of live API calls
6. THE Shared_Library SHALL have unit tests for its XML parsing utilities, GitHub API helper utilities, release creation utilities, and template rendering utilities
7. WHEN unit tests execute for the Release_Checker, Version_Extractor, or Release_Creator, THE testing framework SHALL use mocked dependencies for file system access and network requests so that tests run without external services
8. THE Release_Creator SHALL have unit tests that verify template rendering with valid inputs, handling of missing required inputs, handling of templates with no matching placeholders, and correct invocation of the GitHub release creation API, using mocked HTTP responses instead of live API calls

### Requirement 8: Continuous Integration Workflow

**User Story:** As a contributor to the actions monorepo, I want a CI workflow that automatically runs tests on pull requests, so that code quality is maintained before merging.

#### Acceptance Criteria

1. WHEN a pull request is opened, reopened, or has new commits pushed to it, THE CI_Workflow SHALL run all tests in the monorepo
2. WHEN a pull request modifies files in a JS action directory or the Shared_Library, THE CI_Workflow SHALL build all JS actions to verify NCC_Bundler compilation succeeds
3. THE CI_Workflow SHALL report test results and build status as a GitHub check on the pull request
4. IF any test fails or any NCC_Bundler build fails, THEN THE CI_Workflow SHALL mark the pull request check as failed
5. THE CI_Workflow SHALL be defined in the `.github/workflows/` directory of the Actions_Monorepo

### Requirement 9: Package Naming Convention

**User Story:** As a developer in the LDK-Systems organisation, I want all npm packages in the monorepo to use a consistent naming convention, so that packages are identifiable and scoped to the organisation.

#### Acceptance Criteria

1. THE Actions_Monorepo SHALL prefix all npm package `name` fields in `package.json` with the scope `@ldk-systems/`
2. THE Shared_Library package SHALL be named `@ldk-systems/lib`
3. THE Version_Extractor package SHALL be named `@ldk-systems/extract-dotnet-version`
4. THE Release_Checker package SHALL be named `@ldk-systems/check-release-version`
5. THE Release_Creator package SHALL be named `@ldk-systems/generate-release-notes`
6. WHEN a JS action depends on the Shared_Library, THE action's `package.json` SHALL reference it using the scoped workspace name `@ldk-systems/lib`, and SHALL NOT use unscoped or alternative references to the shared library package

### Requirement 10: Dependency Caching

**User Story:** As a developer in the LDK-Systems organisation, I want workflows to cache dependencies between runs, so that build times are reduced and CI resources are used efficiently.

#### Acceptance Criteria

1. THE CI_Workflow SHALL cache the npm package cache directory using a cache key derived from the hash of `package-lock.json`, restoring the cache on subsequent runs when the lock file has not changed
2. THE DotNet_Build_Workflow SHALL cache the NuGet global packages directory using a cache key derived from the hash of all `*.csproj` and `Directory.Packages.props` files in the project, restoring the cache on subsequent runs when package references have not changed
3. WHEN `build-docker-image` is `true`, THE DotNet_Build_Workflow SHALL use Docker BuildKit cache with the GitHub Actions cache backend to cache image layers between workflow runs
4. WHEN a cache hit occurs for npm or NuGet dependencies, THE respective workflow SHALL restore the cached package directory before executing the package install step so that the install completes without downloading packages from the remote registry, and SHALL save the cache after restoration only if the installation step succeeds
5. WHEN a cache miss occurs, a cache entry has expired or been evicted, or the cache system itself fails (corruption, permission issues), THE respective workflow SHALL fall back to downloading from the remote registry and save the resulting package cache directory for future runs
6. THE CI_Workflow and DotNet_Build_Workflow SHALL restore the dependency cache before the first step that requires packages and save the cache after a successful install step

### Requirement 11: Release Workflow

**User Story:** As a developer in the LDK-Systems organisation, I want a reusable workflow that automatically creates a release when changes are merged to the main branch, so that versioned releases are produced consistently across repositories.

#### Acceptance Criteria

1. THE Release_Workflow SHALL be defined with a `workflow_call` trigger so that other repositories can reference it
2. THE Release_Workflow SHALL accept a required `version` input parameter specifying the release version tag to create
3. THE Release_Workflow SHALL accept an optional `release-notes-template` input parameter containing inline template text for generating release notes; when not provided, the Release_Creator action's default template SHALL be used
4. THE Release_Workflow SHALL accept an optional `template-vars` input parameter as a JSON string of key-value pairs for substitution into the release notes template, defaulting to `{}` when not provided
5. WHEN the workflow is triggered, THE Release_Workflow SHALL invoke the Release_Checker action to verify the version tag does not already exist, and the Release_Checker step SHALL be required to complete successfully before any subsequent steps execute
6. WHEN the Release_Checker confirms the version tag does not exist, THE Release_Workflow SHALL invoke the Release_Creator action passing the `release-notes-template` as the template input, `template-vars` as the template-vars input, `version` as the version input, and the calling repository context as the repository input
7. THE Release_Workflow SHALL authenticate using the GitHub token provided via a `token` secret input, falling back to the default `GITHUB_TOKEN` when no explicit secret is provided
8. IF the Release_Checker action reports that the version tag already exists in the repository, THEN THE Release_Workflow SHALL fail the workflow job with an error message indicating the version already exists and SHALL NOT proceed to invoke the Release_Creator action
9. THE Release_Workflow SHALL be defined in the `.github/workflows/` directory of the Actions_Monorepo
10. WHEN the workflow is triggered, THE Release_Workflow SHALL create the GitHub release on the calling repository (derived from the `github.repository` context of the caller)
11. THE Release_Workflow SHALL accept an optional `artifacts` input parameter specifying file paths or glob patterns of build artifacts to attach to the release
12. WHEN the `artifacts` input is provided and the current branch is `main`, THE Release_Workflow SHALL upload the matching files as assets attached to the created GitHub release
13. WHEN the `artifacts` input is provided and the current branch is not `main`, THE Release_Workflow SHALL skip artifact attachment and not upload any files to the release

### Requirement 12: Templated Release Notes Action

**User Story:** As a CI pipeline author, I want a JS action that generates release notes from a Handlebars template and creates a GitHub release, so that release documentation is consistent and automated across repositories.

#### Acceptance Criteria

1. WHEN a `template` inline input is provided, THE Release_Creator SHALL use the inline template string as the Handlebars template for rendering release notes, taking precedence over any file-based template
2. WHEN no `template` inline input is provided and a `template-file` input specifying a file path is provided, THE Release_Creator SHALL read the template content from the specified file path on disk
3. WHEN neither `template` inline input nor `template-file` input is provided, THE Release_Creator SHALL use a default template file bundled with the action as the Handlebars template
4. THE Release_Creator SHALL use Handlebars as the template engine for rendering release notes, supporting Handlebars syntax including `{{variable}}` placeholders, `{{#if}}` conditionals, and `{{#each}}` iteration
5. THE Release_Creator SHALL accept a `template-vars` input that supports both a JSON string of key-value pairs and multi-line YAML/JSON body format for defining template variables
6. THE Release_Creator SHALL also accept template variables from environment variables prefixed with `RELEASE_VAR_`, stripping the prefix and using the remainder as the variable key name
7. WHEN both `template-vars` input and `RELEASE_VAR_` environment variables provide the same key, THE Release_Creator SHALL give precedence to the `template-vars` input value over the environment variable value
8. WHEN a `version` input and `repository` input (in `owner/repo` format) are provided, THE Release_Creator SHALL create a non-draft, non-prerelease GitHub release on the target repository tagged with the version value, named with the version value, and using the rendered release notes as the release body
9. THE Release_Creator SHALL accept a `token` input for GitHub API authentication, falling back to the default `GITHUB_TOKEN` environment variable when no explicit input is provided
10. THE Release_Creator SHALL output `release-url` containing the URL of the created GitHub release and `release-notes` containing the rendered release notes body
11. IF the `template-vars` input is provided and is not valid JSON, THEN THE Release_Creator SHALL fail the action with an error message indicating the template variables are not valid JSON
12. IF the `version` input is empty or the `repository` input is not in `owner/repo` format (two non-empty strings separated by exactly one `/`), THEN THE Release_Creator SHALL fail the action with an error message indicating the invalid input
13. IF the `template-file` input specifies a file path that does not exist, THEN THE Release_Creator SHALL fail the action with an error message indicating the template file could not be found
14. IF the Handlebars template rendering fails due to syntax errors in the template, THEN THE Release_Creator SHALL fail the action with an error message indicating the template syntax error
15. IF the GitHub API request to create the release fails, THEN THE Release_Creator SHALL fail the action with an error message indicating the cause of failure
16. THE Release_Creator SHALL use the Shared_Library Handlebars template rendering utilities for template compilation and rendering
17. THE Release_Creator SHALL define its inputs and outputs in an Action_Metadata file specifying `node20` as the runtime, with `version` and `repository` as required inputs, `template`, `template-file`, `template-vars`, and `token` as optional inputs, and `release-url` and `release-notes` as outputs
18. THE Actions_Monorepo SHALL include a default release notes template file within the generate-release-notes action directory that provides a standard release notes format

### Requirement 13: Shared Code Reuse Between JS Actions

**User Story:** As a JS action developer, I want all reusable code between JS actions to be placed in the shared library, so that logic is not duplicated and maintenance is centralised.

#### Acceptance Criteria

1. WHEN multiple JS actions require the same utility logic, THE Shared_Library SHALL provide that logic as a shared module rather than each action implementing it independently; actions MAY implement logic inline temporarily until the Shared_Library is updated, but SHALL migrate to the shared module once available
2. THE Release_Creator SHALL import template rendering and GitHub release creation utilities from the Shared_Library rather than implementing them inline
3. THE Release_Checker SHALL import GitHub API query utilities from the Shared_Library rather than implementing them inline
4. THE Version_Extractor SHALL import XML parsing utilities from the Shared_Library rather than implementing them inline
5. WHEN a new utility is added to the Shared_Library, THE Shared_Library SHALL export it as a named export from the package entry point
6. THE Shared_Library SHALL maintain backward compatibility for existing exports when new utilities are added
