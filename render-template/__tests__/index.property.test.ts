// Feature: render-template, Property: template-vars JSON validation
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * For any string input to template-vars, if the string is not valid JSON or
 * parses to a value that is not a plain object (array, string, number, boolean,
 * or null), the action SHALL fail with a validation error. For any string that
 * parses to a valid JSON object, the action SHALL NOT fail due to template-vars
 * validation.
 */
describe('Property: template-vars JSON validation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  function setupMocks(templateVarsValue: string) {
    vi.doMock('@actions/core', () => ({
      getInput: vi.fn((name: string) => {
        if (name === 'template') return '{{greeting}}';
        if (name === 'template-vars') return templateVarsValue;
        return '';
      }),
      setOutput: vi.fn(),
      setFailed: vi.fn(),
    }));

    vi.doMock('@ldk-systems/lib', () => ({
      renderTemplate: vi.fn(() => 'rendered'),
    }));
  }

  it('valid JSON objects pass validation, invalid JSON and non-object values fail', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // Valid JSON objects — should pass
          fc
            .dictionary(
              fc
                .string({ minLength: 1, maxLength: 10 })
                .filter((s) => !s.includes('"') && !s.includes('\\')),
              fc.jsonValue(),
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

          // JSON primitives — should fail with "must be a JSON object"
          fc
            .oneof(
              fc.string({ minLength: 0, maxLength: 20 }),
              fc.integer(),
              fc.boolean(),
              fc.constant(null),
            )
            .map((v) => ({ input: JSON.stringify(v), category: 'non-object' as const })),
        ),
        async ({ input, category }) => {
          vi.resetModules();
          setupMocks(input);

          const coreModule = await import('@actions/core');
          const mockedSetFailed = vi.mocked(coreModule.setFailed);

          await import('../src/index');
          await new Promise((resolve) => setTimeout(resolve, 0));

          if (category === 'valid-object') {
            const hasValidationFailure = mockedSetFailed.mock.calls.some(
              (call) =>
                String(call[0]).includes('not valid JSON') ||
                String(call[0]).includes('must be a JSON object'),
            );
            expect(hasValidationFailure).toBe(false);
          } else if (category === 'invalid-json') {
            expect(mockedSetFailed).toHaveBeenCalled();
            expect(String(mockedSetFailed.mock.calls[0][0])).toContain('not valid JSON');
          } else {
            expect(mockedSetFailed).toHaveBeenCalled();
            expect(String(mockedSetFailed.mock.calls[0][0])).toContain('must be a JSON object');
          }
        },
      ),
      { numRuns: 100 },
    );
  }, 30000);
});
