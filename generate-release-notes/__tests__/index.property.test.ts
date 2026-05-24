// Feature: github-actions-monorepo, Property 6: Template variables JSON validation
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import * as core from '@actions/core';

vi.mock('@actions/core');
vi.mock('@actions/github', () => ({
  getOctokit: () => ({
    rest: {
      repos: {
        createRelease: vi.fn().mockResolvedValue({
          data: {
            id: 1,
            url: 'https://api.github.com/releases/1',
            html_url: 'https://github.com/owner/repo/releases/tag/v1.0.0',
          },
        }),
      },
    },
  }),
}));

/**
 * Validates: Requirements 12.5
 *
 * Property 6: Template variables JSON validation
 *
 * For any string input to template-vars, if the string is not valid JSON or
 * parses to a value that is not a plain object (i.e., is an array, string,
 * number, boolean, or null), the Release_Creator SHALL fail with a validation
 * error. For any string that parses to a valid JSON object with string values,
 * the action SHALL NOT fail due to template-vars validation.
 */
describe('Property 6: Template variables JSON validation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  // Re-mock after resetModules
  function setupMocks(templateVarsValue: string) {
    vi.doMock('@actions/core', () => ({
      getInput: vi.fn((name: string) => {
        switch (name) {
          case 'template':
            return 'Release {{version}}';
          case 'template-vars':
            return templateVarsValue;
          case 'version':
            return '1.0.0';
          case 'repository':
            return 'owner/repo';
          case 'token':
            return 'fake-token';
          default:
            return '';
        }
      }),
      setOutput: vi.fn(),
      setFailed: vi.fn(),
    }));

    vi.doMock('@actions/github', () => ({
      getOctokit: () => ({
        rest: {
          repos: {
            createRelease: vi.fn().mockResolvedValue({
              data: {
                id: 1,
                url: 'https://api.github.com/releases/1',
                html_url: 'https://github.com/owner/repo/releases/tag/v1.0.0',
              },
            }),
          },
        },
      }),
    }));

    vi.doMock('@ldk-systems/lib', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@ldk-systems/lib')>();
      const { setFailed: coreSF } = await import('@actions/core');
      return {
        ...actual,
        runAction: (fn: () => Promise<void>) => {
          fn().catch((error: unknown) => {
            coreSF(error instanceof Error ? error.message : 'An unexpected error occurred');
          });
        },
      };
    });
  }

  it('valid JSON objects pass validation, invalid JSON and non-object JSON values fail', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // Valid JSON objects with string values — should pass
          fc
            .dictionary(
              fc
                .string({ minLength: 1, maxLength: 10 })
                .filter((s) => !s.includes('"') && !s.includes('\\')),
              fc
                .string({ minLength: 0, maxLength: 20 })
                .filter((s) => !s.includes('"') && !s.includes('\\')),
              { minKeys: 0, maxKeys: 5 },
            )
            .map((obj) => ({ input: JSON.stringify(obj), category: 'valid-object' as const })),

          // Invalid JSON strings — should fail with "not valid JSON"
          fc
            .string({ minLength: 1, maxLength: 50 })
            .filter((s) => {
              try {
                JSON.parse(s);
                return false;
              } catch {
                return true;
              }
            })
            .map((s) => ({ input: s, category: 'invalid-json' as const })),

          // JSON arrays — should fail with "must be a JSON object"
          fc
            .array(fc.jsonValue(), { minLength: 0, maxLength: 5 })
            .map((arr) => ({ input: JSON.stringify(arr), category: 'non-object' as const })),

          // JSON strings — should fail with "must be a JSON object"
          fc
            .string({ minLength: 0, maxLength: 20 })
            .map((s) => ({ input: JSON.stringify(s), category: 'non-object' as const })),

          // JSON numbers — should fail with "must be a JSON object"
          fc
            .oneof(fc.integer(), fc.double({ noNaN: true, noDefaultInfinity: true }))
            .map((n) => ({ input: JSON.stringify(n), category: 'non-object' as const })),

          // JSON booleans — should fail with "must be a JSON object"
          fc.boolean().map((b) => ({ input: JSON.stringify(b), category: 'non-object' as const })),

          // JSON null — should fail with "must be a JSON object"
          fc.constant({ input: 'null', category: 'non-object' as const }),
        ),
        async ({ input, category }) => {
          vi.resetModules();
          setupMocks(input);

          const coreModule = (await import('@actions/core')) as typeof core;
          const mockedSetFailed = vi.mocked(coreModule.setFailed);

          await import('../src/index');

          // Flush the microtask queue for async error paths
          await Promise.resolve();
          await Promise.resolve();

          if (category === 'valid-object') {
            // Should NOT fail due to template-vars validation
            const failCalls = mockedSetFailed.mock.calls;
            const templateVarsFailure = failCalls.some(
              (call) =>
                String(call[0]).includes('not valid JSON') ||
                String(call[0]).includes('must be a JSON object'),
            );
            expect(templateVarsFailure).toBe(false);
          } else if (category === 'invalid-json') {
            // Should fail with "not valid JSON"
            expect(mockedSetFailed).toHaveBeenCalled();
            const failMessage = String(mockedSetFailed.mock.calls[0][0]);
            expect(failMessage).toContain('not valid JSON');
          } else {
            // non-object: should fail with "must be a JSON object"
            expect(mockedSetFailed).toHaveBeenCalled();
            const failMessage = String(mockedSetFailed.mock.calls[0][0]);
            expect(failMessage).toContain('must be a JSON object');
          }
        },
      ),
      { numRuns: 100 },
    );
  }, 30000);
});
