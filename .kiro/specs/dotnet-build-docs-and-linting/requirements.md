# Requirements Document

## Introduction

This feature extends the existing `.NET Build` reusable GitHub Actions workflow (`dotnet-build.yml`) with two new opt-in capabilities: documentation generation using DocFX and code linting/analysis checks. Both features follow the established workflow patterns of boolean toggle inputs with supporting configuration inputs, input validation steps, and conditional execution.

## Glossary

- **Workflow**: The reusable GitHub Actions workflow defined in `.github/workflows/dotnet-build.yml`
- **DocFX**: A static documentation generator for .NET projects that produces API reference documentation from source code and conceptual articles from Markdown files
- **Linting**: Static code analysis that identifies code style violations, potential bugs, and maintainability issues without executing the code
- **Roslyn_Analyzers**: The .NET Compiler Platform analyzers that perform static code analysis during build, configured via `.editorconfig` or analyzer packages
- **Caller_Workflow**: A GitHub Actions workflow that invokes the reusable Workflow via `workflow_call`

## Requirements

### Requirement 1: Documentation Generation Toggle

**User Story:** As a Caller_Workflow author, I want to opt in to documentation generation, so that API documentation is produced as part of the build pipeline without requiring a separate workflow.

#### Acceptance Criteria

1. THE Workflow SHALL expose a boolean input `generate-docs` with a default value of `false`
2. WHEN `generate-docs` is `true`, THE Workflow SHALL expose a required string input `docfx-project-path` that specifies the path to the DocFX project file
3. WHEN `generate-docs` is `true`, THE Workflow SHALL install DocFX, execute it against the file specified by `docfx-project-path`, and upload the generated output as a build artifact
4. IF `generate-docs` is `true` and the DocFX generation step fails, THEN THE Workflow SHALL fail the job with an error indicating the documentation generation failure
5. WHEN `generate-docs` is `false`, THE Workflow SHALL skip all documentation generation steps

### Requirement 2: Documentation Project Path Configuration

**User Story:** As a Caller_Workflow author, I want to specify the path to my DocFX configuration, so that the Workflow can locate my documentation project.

#### Acceptance Criteria

1. THE Workflow SHALL expose a string input `docfx-project-path` with `required` set to `false` and no default value, for specifying the relative path from the repository root to the DocFX configuration file
2. IF `generate-docs` is `true` and `docfx-project-path` is empty or contains only whitespace, THEN THE Workflow SHALL fail and emit an `::error::` message indicating that `docfx-project-path` is required when `generate-docs` is enabled
3. IF `generate-docs` is `true` and `docfx-project-path` is provided and the specified file does not exist in the checked-out repository, THEN THE Workflow SHALL fail and emit an `::error::` message indicating that the DocFX configuration file was not found at the specified path
4. IF `generate-docs` is `true` and `docfx-project-path` references an existing file, THEN THE Workflow SHALL pass the specified path to the DocFX build step as the project configuration file

### Requirement 3: Documentation Output as Artifact

**User Story:** As a Caller_Workflow author, I want generated documentation to be uploaded as a build artifact, so that I can deploy or publish it in subsequent workflow steps.

#### Acceptance Criteria

1. THE Workflow SHALL expose a string input `docs-output-path` with a default value of `_site` that specifies the relative path to the generated documentation directory
2. THE Workflow SHALL expose a string input `docs-artifact-name` with a default value of `documentation`
3. WHEN `generate-docs` is `true` and the documentation generation step completes with exit code 0, THE Workflow SHALL upload the directory specified by the `docs-output-path` input as a build artifact named with the `docs-artifact-name` input value
4. IF `generate-docs` is `true` and the documentation generation step completes with exit code 0 but the directory specified by `docs-output-path` does not exist or contains no files, THEN THE Workflow SHALL fail the job with an error message indicating the documentation output directory is missing or empty

### Requirement 4: Linting Toggle

**User Story:** As a Caller_Workflow author, I want to opt in to linting checks, so that code quality is enforced as part of the build pipeline.

#### Acceptance Criteria

1. THE Workflow SHALL expose a boolean input `run-linting` with a default value of `false`
2. WHEN `run-linting` is `true`, THE Workflow SHALL execute `dotnet format` with the `--verify-no-changes` flag against the `project-path` input to check for formatting and analyzer violations without modifying source files
3. WHEN `run-linting` is `true`, THE Workflow SHALL run the linting step after dependency restore has completed
4. IF `run-linting` is `true` and `dotnet format --verify-no-changes` exits with a non-zero code, THEN THE Workflow SHALL fail the workflow run
5. WHEN `run-linting` is `false`, THE Workflow SHALL skip all linting steps

### Requirement 5: Linting Configuration

**User Story:** As a Caller_Workflow author, I want to configure the severity level that causes linting to fail the build, so that I can control how strictly code quality is enforced.

#### Acceptance Criteria

1. THE Workflow SHALL expose a string input `linting-severity` with a default value of `warn`
2. THE Workflow SHALL accept the following case-sensitive values for `linting-severity`: `info`, `warn`, `error`
3. IF `linting-severity` is set to a value other than `info`, `warn`, `error`, THEN THE Workflow SHALL fail the validation step with a non-zero exit code and emit an error annotation listing the valid values (`info`, `warn`, `error`)
4. IF `run-linting` is `true`, THEN THE Workflow SHALL pass the configured `linting-severity` value as the `--severity` argument to the `dotnet format` analyzer command
5. IF `run-linting` is `true` and `dotnet format` detects analyzer diagnostics at or above the configured severity, THEN THE Workflow SHALL fail the linting step with a non-zero exit code
6. IF `run-linting` is `false`, THEN THE Workflow SHALL skip the linting step and not evaluate the `linting-severity` input

### Requirement 6: Linting Execution via dotnet format

**User Story:** As a Caller_Workflow author, I want linting to use `dotnet format` for analysis, so that the checks align with the project's existing `.editorconfig` and analyzer configuration.

#### Acceptance Criteria

1. WHEN `run-linting` is `true`, THE Workflow SHALL run `dotnet format` against the path specified by the `project-path` input with the `--verify-no-changes` flag to detect code style and analyzer violations, executing this step after the restore step has completed successfully
2. WHEN `run-linting` is `true`, THE Workflow SHALL pass the `--severity` flag to `dotnet format` using the value from the `linting-severity` input, which accepts the values `info`, `warn`, or `error` and defaults to `warn` when not provided
3. WHEN `dotnet format` exits with a non-zero exit code indicating violations, THE Workflow SHALL fail the workflow job with the violation details visible in the step's standard output within the workflow log
4. WHEN `run-linting` is `false` or not provided, THE Workflow SHALL skip the `dotnet format` step entirely and proceed to subsequent steps
5. IF `linting-severity` is provided with a value other than `info`, `warn`, or `error`, THEN THE Workflow SHALL fail the workflow job with an error message indicating the invalid severity level

### Requirement 7: Step Ordering

**User Story:** As a Caller_Workflow author, I want linting to run before documentation generation, so that documentation is only generated for code that passes quality checks.

#### Acceptance Criteria

1. WHEN both `run-linting` and `generate-docs` are `true` and the build step completes with exit code 0, THE Workflow SHALL execute all linting steps before any documentation generation steps within the same job
2. IF `run-linting` is `true` and any linting step exits with a non-zero exit code, THEN THE Workflow SHALL skip all documentation generation steps by applying an `if: success()` condition that evaluates to false
3. WHEN `run-linting` is `true` and the build step completes with exit code 0, THE Workflow SHALL execute linting steps after the build step and before the test step in the job step sequence
4. WHEN `run-linting` is `false` and `generate-docs` is `true` and the build step completes with exit code 0, THE Workflow SHALL execute documentation generation steps without requiring linting to pass

### Requirement 8: DocFX Installation

**User Story:** As a Caller_Workflow author, I want DocFX to be installed automatically when documentation generation is enabled, so that I do not need to manage tooling installation in my caller workflow.

#### Acceptance Criteria

1. WHEN `generate-docs` is `true`, THE Workflow SHALL install DocFX as a .NET global tool by running `dotnet tool install -g docfx` before executing any documentation generation step
2. THE Workflow SHALL expose a string input `docfx-version` with a default value of `latest` for specifying the DocFX tool version
3. WHEN `docfx-version` is set to `latest`, THE Workflow SHALL install DocFX without a `--version` flag, allowing the .NET CLI to resolve the most recent stable release from NuGet
4. WHEN `docfx-version` is set to a NuGet-compatible version string (e.g., `2.78.2`), THE Workflow SHALL install that exact version by passing `--version <version>` to the `dotnet tool install` command
5. IF the `dotnet tool install` command exits with a non-zero exit code, THEN THE Workflow SHALL fail the job and surface the error output from the install command in the workflow log
