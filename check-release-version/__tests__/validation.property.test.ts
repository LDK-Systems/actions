// Feature: github-actions-monorepo, Property 5: Repository input format validation
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Validates: Requirements 3.4, 12.6
 *
 * Property 5: Repository input format validation
 *
 * For any string that is not in the format of two non-empty strings separated
 * by exactly one `/` character, the Release_Checker action SHALL fail with an
 * input validation error. For any string that IS in valid `owner/repo` format,
 * the action SHALL NOT fail due to input format validation.
 */

// Mock @actions/core
const mockGetInput = vi.fn();
const mockSetOutput = vi.fn();
const mockSetFailed = vi.fn();

vi.mock('@actions/core', () => ({
  getInput: (...args: unknown[]) => mockGetInput(...args),
  setOutput: (...args: unknown[]) => mockSetOutput(...args),
  setFailed: (...args: unknown[]) => mockSetFailed(...args),
}));

// Mock @ldk-systems/lib - releaseExists resolves to false (no release found)
const mockReleaseExists = vi.fn();

vi.mock('@ldk-systems/lib', () => ({
  releaseExists: (...args: unknown[]) => mockReleaseExists(...args),
}));

/**
 * Determines if a string is a valid owner/repo format:
 * two non-empty (after trimming) parts separated by exactly one `/`.
 */
function isValidRepoFormat(s: string): boolean {
  const parts = s.split('/');
  return parts.length === 2 && parts[0].trim().length > 0 && parts[1].trim().length > 0;
}

describe('Property 5: Repository input format validation', () => {
  beforeEach(() => {
    mockGetInput.mockReset();
    mockSetOutput.mockReset();
    mockSetFailed.mockReset();
    mockReleaseExists.mockReset();
  });

  // Arbitrary for valid owner/repo strings: two non-empty, non-whitespace-only
  // segments with no `/` characters, joined by a single `/`
  const ownerPartArb = fc.stringOf(
    fc.char().filter((c) => c !== '/' && c.trim().length > 0),
    { minLength: 1, maxLength: 20 },
  );

  const validRepoArb = fc
    .tuple(ownerPartArb, ownerPartArb)
    .map(([owner, repo]) => `${owner}/${repo}`);

  // Arbitrary for invalid repo formats: strings that do NOT match owner/repo
  const invalidRepoArb = fc
    .oneof(
      // Empty string
      fc.constant(''),
      // Whitespace only
      fc.stringOf(fc.constantFrom(' ', '\t', '\n'), { minLength: 1, maxLength: 5 }),
      // No slash at all
      fc.stringOf(
        fc.char().filter((c) => c !== '/'),
        { minLength: 1, maxLength: 20 },
      ),
      // Multiple slashes (3 or more parts)
      fc
        .tuple(
          fc.stringOf(
            fc.char().filter((c) => c !== '/'),
            { minLength: 1, maxLength: 10 },
          ),
          fc.stringOf(
            fc.char().filter((c) => c !== '/'),
            { minLength: 1, maxLength: 10 },
          ),
          fc.stringOf(
            fc.char().filter((c) => c !== '/'),
            { minLength: 1, maxLength: 10 },
          ),
        )
        .map(([a, b, c]) => `${a}/${b}/${c}`),
      // Slash but empty owner (starts with /)
      fc
        .stringOf(
          fc.char().filter((c) => c !== '/'),
          { minLength: 1, maxLength: 10 },
        )
        .map((s) => `/${s}`),
      // Slash but empty repo (ends with /)
      fc
        .stringOf(
          fc.char().filter((c) => c !== '/'),
          { minLength: 1, maxLength: 10 },
        )
        .map((s) => `${s}/`),
      // Only a slash
      fc.constant('/'),
      // Slash with whitespace-only owner
      fc
        .tuple(
          fc.stringOf(fc.constantFrom(' ', '\t'), { minLength: 1, maxLength: 3 }),
          fc.stringOf(
            fc.char().filter((c) => c !== '/' && c.trim().length > 0),
            { minLength: 1, maxLength: 10 },
          ),
        )
        .map(([ws, repo]) => `${ws}/${repo}`),
      // Slash with whitespace-only repo
      fc
        .tuple(
          fc.stringOf(
            fc.char().filter((c) => c !== '/' && c.trim().length > 0),
            { minLength: 1, maxLength: 10 },
          ),
          fc.stringOf(fc.constantFrom(' ', '\t'), { minLength: 1, maxLength: 3 }),
        )
        .map(([owner, ws]) => `${owner}/${ws}`),
    )
    .filter((s) => !isValidRepoFormat(s));

  it('invalid repository formats cause setFailed to be called, valid formats do not fail on format validation', async () => {
    const repoInputArb = fc.oneof(
      validRepoArb.map((r) => ({ repo: r, valid: true })),
      invalidRepoArb.map((r) => ({ repo: r, valid: false })),
    );

    await fc.assert(
      fc.asyncProperty(repoInputArb, async ({ repo, valid }) => {
        // Reset mocks for each iteration
        mockGetInput.mockReset();
        mockSetOutput.mockReset();
        mockSetFailed.mockReset();
        mockReleaseExists.mockReset();

        // Set up getInput to return a valid version and the generated repository
        mockGetInput.mockImplementation((name: string) => {
          if (name === 'version') return '1.0.0';
          if (name === 'repository') return repo;
          if (name === 'token') return 'fake-token';
          return '';
        });

        // Mock releaseExists to resolve successfully (no format-related failure)
        mockReleaseExists.mockResolvedValue(false);

        // Reset modules so the action's run() executes fresh each time
        vi.resetModules();
        await import('../src/index.ts');

        // Allow async operations to complete
        await new Promise((resolve) => setTimeout(resolve, 10));

        if (valid) {
          // For valid formats: setFailed should NOT be called with a repository format error
          const formatErrorCalls = mockSetFailed.mock.calls.filter(
            (call: unknown[]) =>
              typeof call[0] === 'string' &&
              call[0].toLowerCase().includes('repository') &&
              call[0].toLowerCase().includes('format'),
          );
          expect(formatErrorCalls).toHaveLength(0);
        } else {
          // For invalid formats: setFailed SHOULD be called
          expect(mockSetFailed).toHaveBeenCalled();
          // And the message should mention repository format
          const failMessage = mockSetFailed.mock.calls[0][0] as string;
          expect(failMessage.toLowerCase()).toMatch(/repository/);
        }
      }),
      { numRuns: 100 },
    );
  });
});
