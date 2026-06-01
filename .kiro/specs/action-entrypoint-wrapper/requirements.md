# Requirements Document

## Introduction

This feature enhances the shared action entrypoint wrapper (`runAction`) in `packages/lib` and introduces a `getInput` utility function that provides consistent input retrieval with environment variable fallback and default value support. The goal is to eliminate ad-hoc `core.getInput('x') || process.env.Y || ''` patterns scattered across actions and centralize error handling in a single, well-tested wrapper.

## Glossary

- **Action_Wrapper**: The `runAction` function in `packages/lib` that wraps an action's async entrypoint with consistent error handling
- **Input_Resolver**: The `getInput` utility function that retrieves action inputs with environment variable fallback and default value support
- **Action_Function**: The async function passed to the Action_Wrapper representing the action's main logic
- **Input_Name**: The name of a GitHub Actions input as defined in `action.yml`
- **Environment_Variable_Name**: The name of a process environment variable used as a fallback source for input values
- **Default_Value**: A fallback string value returned when neither the action input nor the environment variable provides a value

## Requirements

### Requirement 1: Action Entrypoint Wrapper Error Handling

**User Story:** As an action developer, I want a consistent entrypoint wrapper that catches all errors and reports them via `core.setFailed`, so that no action can fail silently or produce unhandled promise rejections.

#### Acceptance Criteria

1. WHEN the Action_Function resolves successfully, THE Action_Wrapper SHALL NOT call `core.setFailed`
2. WHEN the Action_Function rejects with an Error instance, THE Action_Wrapper SHALL call `core.setFailed` with the value of the Error's `message` property
3. WHEN the Action_Function rejects with a non-Error value, THE Action_Wrapper SHALL call `core.setFailed` with a non-empty fallback string that does not include the rejected value
4. WHEN the Action_Function throws synchronously before returning a Promise, THE Action_Wrapper SHALL catch the error and call `core.setFailed` with the value of the Error's `message` property
5. THE Action_Wrapper SHALL accept a single argument that is an async function with no parameters and a void return type
6. IF the Action_Function throws or rejects, THEN THE Action_Wrapper SHALL NOT propagate the error to the caller as an unhandled exception or unhandled promise rejection

### Requirement 2: Input Retrieval with Environment Variable Fallback

**User Story:** As an action developer, I want a `getInput` utility that checks an environment variable when the action input is empty, so that I can support both GitHub Actions inputs and environment-based configuration without duplicating fallback logic.

#### Acceptance Criteria

1. WHEN an Input_Name is provided and the corresponding action input has a non-empty trimmed value, THE Input_Resolver SHALL return the trimmed action input value
2. WHEN an Input_Name is provided and the corresponding action input is empty after trimming, AND an Environment_Variable_Name is specified (non-empty string parameter) with a non-empty value in `process.env`, THE Input_Resolver SHALL return the environment variable value as-is without trimming
3. WHEN an Input_Name is provided and the corresponding action input is empty after trimming, AND the Environment_Variable_Name parameter is not provided (undefined) or is an empty string, THE Input_Resolver SHALL return an empty string
4. WHEN an Input_Name is provided and the corresponding action input is empty after trimming, AND the Environment_Variable_Name parameter is a non-empty string but the corresponding environment variable is undefined or is an empty string in `process.env`, THE Input_Resolver SHALL return an empty string
5. THE Input_Resolver SHALL trim leading and trailing whitespace from the retrieved action input value before evaluating emptiness, consistent with `core.getInput` behavior
6. THE Input_Resolver SHALL accept two parameters: an Input_Name string (required) and an optional options object containing the Environment_Variable_Name that identifies the fallback environment variable to read from `process.env`

### Requirement 3: Input Retrieval with Default Value Support

**User Story:** As an action developer, I want to specify a default value for an input, so that the action uses a sensible fallback when neither the action input nor the environment variable provides a value.

#### Acceptance Criteria

1. WHEN the action input is empty after trimming AND the environment variable is either undefined or an empty string, AND a Default_Value is provided in the options object, THE Input_Resolver SHALL return the Default_Value as-is without trimming
2. WHEN the action input has a non-empty trimmed value, THE Input_Resolver SHALL return the trimmed action input value regardless of any Default_Value or environment variable value
3. WHEN the environment variable has a non-empty value AND the action input is empty after trimming, THE Input_Resolver SHALL return the environment variable value regardless of any Default_Value specified
4. WHEN no Default_Value is provided in the options object AND the action input is empty after trimming AND the environment variable is either undefined or an empty string, THE Input_Resolver SHALL return an empty string

### Requirement 4: Input Retrieval Required Option

**User Story:** As an action developer, I want to mark an input as required, so that the action fails early with a clear message when a mandatory input is missing from all sources.

#### Acceptance Criteria

1. IF an input is marked as required AND the action input is empty after trimming AND the environment variable is empty or unspecified AND no Default_Value is provided, THEN THE Input_Resolver SHALL throw an Error whose message contains the Input_Name
2. IF an input is marked as required AND any source (action input, environment variable, or Default_Value) provides a non-empty value, THEN THE Input_Resolver SHALL return that resolved value without throwing
3. IF an input is marked as required AND the action input contains only whitespace characters AND the environment variable is empty or unspecified AND no Default_Value is provided, THEN THE Input_Resolver SHALL throw an Error indicating the input is required

### Requirement 5: Consistent Adoption Across Actions

**User Story:** As a maintainer, I want all actions to use the shared Input_Resolver for token retrieval patterns, so that the codebase is consistent and easier to maintain.

#### Acceptance Criteria

1. THE check-release-version action SHALL use the Input_Resolver to retrieve the `'token'` input with `GITHUB_TOKEN` as the Environment_Variable_Name and no Default_Value
2. THE generate-release-notes action SHALL use the Input_Resolver to retrieve the `'token'` input with `GITHUB_TOKEN` as the Environment_Variable_Name and no Default_Value
3. WHEN an action uses the Input_Resolver for a given input, THE action SHALL NOT contain any manual environment variable access or chained OR-expression fallback logic (e.g., `core.getInput('x') || process.env.Y || ''`) for that same input
4. WHEN an action retrieves the token via the Input_Resolver with no Default_Value and the `required` option is not set, THE action SHALL receive an empty string if both the action input and the `GITHUB_TOKEN` environment variable are empty or unset

### Requirement 6: Input Resolver Resolution Precedence

**User Story:** As an action developer, I want a clearly defined resolution order for input values, so that I can predict which source takes priority.

#### Acceptance Criteria

1. THE Input_Resolver SHALL resolve values in the following precedence order: action input (highest), environment variable, Default_Value, empty string (lowest)
2. IF the action input has a non-empty trimmed value, THEN THE Input_Resolver SHALL return the trimmed action input value regardless of environment variable or Default_Value contents
3. IF the action input is empty after trimming and the environment variable has a non-empty value, THEN THE Input_Resolver SHALL return the environment variable value regardless of Default_Value contents
4. IF the action input is empty after trimming and the environment variable is empty or unspecified, and a Default_Value is provided, THEN THE Input_Resolver SHALL return the Default_Value
5. IF the action input is empty after trimming and the environment variable is empty or unspecified, and no Default_Value is provided, THEN THE Input_Resolver SHALL return an empty string
