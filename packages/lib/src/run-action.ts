import * as core from '@actions/core';

/**
 * Wraps an action's main function, ensuring all errors are reported via core.setFailed.
 */
export function runAction(fn: () => Promise<void>): void {
  fn().catch((error: unknown) => {
    core.setFailed(error instanceof Error ? error.message : 'An unexpected error occurred');
  });
}
