# Design: Consistent Action Error Handling via `runAction`

**Date:** 2026-05-24  
**Status:** Approved

## Problem

All four actions (`check-release-version`, `extract-dotnet-version`, `generate-release-notes`, `render-template`) implement their own outer `try/catch` in `run()` with slightly inconsistent fallback messages for non-Error rejections. Additionally, the bare `run()` call at the bottom of each file does not handle the returned promise, leaving a gap where a failure inside the catch block itself would produce an unhandled rejection.

## Goal

Centralize fallback error handling in a single shared utility in `@ldk-systems/lib`, and make each action's entrypoint consistent and minimal.

## Design

### New utility: `packages/lib/src/run-action.ts`

A single exported function `runAction` that takes an async action body, invokes it, and attaches a `.catch()` to report any unhandled rejection via `core.setFailed`.

```ts
import * as core from '@actions/core';

/**
 * Wraps an action's main function, ensuring all errors are reported via core.setFailed.
 */
export function runAction(fn: () => Promise<void>): void {
  fn().catch((error: unknown) => {
    core.setFailed(error instanceof Error ? error.message : 'An unexpected error occurred');
  });
}
```

- Returns `void` (not a Promise) so callers have nothing to await or handle.
- Uses `.catch()` rather than `async/await` so the function itself never returns a rejecting promise.
- Non-Error rejections produce `'An unexpected error occurred'` — consistent across all actions.

`runAction` is exported from `packages/lib/src/index.ts`.

### Changes to each action's `index.ts`

For all four actions:

1. Add `runAction` to the `@ldk-systems/lib` import.
2. Remove the outer `try/catch` wrapping the `run()` body. Inner `try/catch` blocks for specific operations (JSON parsing, template resolution, XML parsing) remain unchanged — they produce specific, meaningful error messages via `core.setFailed` and `return`.
3. Replace the bare `run()` call with `runAction(run)`.

### Testing

New test file: `packages/lib/__tests__/run-action.test.ts`

Covers three cases:
- `fn` resolves successfully — `core.setFailed` is never called.
- `fn` rejects with an `Error` instance — `core.setFailed` is called with `error.message`.
- `fn` rejects with a non-Error value — `core.setFailed` is called with `'An unexpected error occurred'`.

`@actions/core` is mocked in the test. No changes are needed to existing action tests since they call `run()` directly and do not go through `runAction`.

## Files Affected

| File | Change |
|---|---|
| `packages/lib/src/run-action.ts` | New file |
| `packages/lib/src/index.ts` | Add `runAction` export |
| `packages/lib/__tests__/run-action.test.ts` | New test file |
| `check-release-version/src/index.ts` | Remove outer try/catch, replace `run()` with `runAction(run)` |
| `extract-dotnet-version/src/index.ts` | Remove outer try/catch, replace `run()` with `runAction(run)` |
| `generate-release-notes/src/index.ts` | Remove outer try/catch, replace `run()` with `runAction(run)` |
| `render-template/src/index.ts` | Remove outer try/catch, replace `run()` with `runAction(run)` |

## Out of Scope

- Changing any inner `try/catch` blocks or their error messages.
- Modifying the reusable workflows.
- Any changes to `packages/lib` exports beyond adding `runAction`.
