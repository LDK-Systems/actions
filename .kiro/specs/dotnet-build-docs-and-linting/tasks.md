# Implementation Plan: .NET Build — Documentation Generation & Linting

## Overview

Extend the existing `.NET Build` reusable workflow (`dotnet-build.yml`) with two new opt-in feature blocks: code linting via `dotnet format` and documentation generation via DocFX. Both follow the established patterns of boolean toggle inputs, input validation steps, and conditional execution with `if: success()` guards. All changes are made to a single file: `.github/workflows/dotnet-build.yml`.

## Tasks

- [ ] 1. Add new workflow inputs for linting and documentation
  - [ ] 1.1 Add linting-related inputs to `workflow_call.inputs`
    - Add `run-linting` boolean input with default `false`
    - Add `linting-severity` string input with default `warn`
    - _Requirements: 4.1, 5.1, 5.2_

  - [ ] 1.2 Add documentation-related inputs to `workflow_call.inputs`
    - Add `generate-docs` boolean input with default `false`
    - Add `docfx-project-path` string input with no default
    - Add `docs-output-path` string input with default `_site`
    - Add `docs-artifact-name` string input with default `documentation`
    - Add `docfx-version` string input with default `latest`
    - _Requirements: 1.1, 2.1, 3.1, 3.2, 8.2_

- [ ] 2. Implement linting steps
  - [ ] 2.1 Add linting validation and execution steps after the Build step and before the Test step
    - Add `Validate linting inputs` step with `if: success() && inputs.run-linting == true` that validates `linting-severity` is one of `info`, `warn`, `error` and emits `::error::` on invalid values
    - Add `Lint with dotnet format` step with `if: success() && inputs.run-linting == true` that runs `dotnet format <project-path> --verify-no-changes --severity <linting-severity>`
    - Insert both steps between the existing Build step and the existing Test step
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 7.3_

- [ ] 3. Implement documentation generation steps
  - [ ] 3.1 Add documentation validation, installation, generation, and upload steps after the Test step and before the Docker steps
    - Add `Validate docs inputs` step with `if: success() && inputs.generate-docs == true` that checks `docfx-project-path` is not empty/whitespace
    - Add `Validate docfx-project-path exists` step with `if: success() && inputs.generate-docs == true` that checks the file exists
    - Add `Install DocFX` step with `if: success() && inputs.generate-docs == true` that runs `dotnet tool install -g docfx` (with `--version` when `docfx-version` is not `latest`)
    - Add `Generate documentation` step with `if: success() && inputs.generate-docs == true` that runs `docfx build <docfx-project-path>`
    - Add `Validate docs output` step with `if: success() && inputs.generate-docs == true` that checks the output directory exists and is non-empty
    - Add `Upload documentation artifact` step with `if: success() && inputs.generate-docs == true` using `actions/upload-artifact@v4`
    - Insert all steps after the Test step and before the existing `Validate Docker inputs` step
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 2.2, 2.3, 2.4, 3.3, 3.4, 7.1, 7.2, 7.4, 8.1, 8.3, 8.4, 8.5_

- [ ] 4. Checkpoint - Validate workflow structure
  - Ensure the YAML is syntactically valid, all new steps have correct `if:` conditions, and step ordering matches the design (linting after Build, before Test; docs after Test, before Docker). Ask the user if questions arise.

- [ ] 5. Verify end-to-end correctness
  - [ ] 5.1 Validate YAML syntax and structural correctness
    - Parse the workflow file to confirm valid YAML
    - Verify all 7 new inputs are declared with correct types and defaults
    - Verify all new steps have `if: success() && inputs.<toggle> == true` guards
    - Verify step ordering: linting steps appear after Build and before Test; documentation steps appear after Test and before Docker validation
    - _Requirements: 1.1, 1.5, 4.1, 4.5, 5.1, 7.1, 7.2, 7.3_

- [ ] 6. Final checkpoint - Ensure workflow is complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All implementation is in a single file: `.github/workflows/dotnet-build.yml`
- No property-based tests apply — the feature is declarative YAML configuration with no custom pure functions
- The design explicitly places linting after Build (step 5) and before Test (step 8), and documentation after Test
- Both feature blocks use `if: success()` guards so linting failure cascades to skip documentation steps
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["5.1"] }
  ]
}
```
