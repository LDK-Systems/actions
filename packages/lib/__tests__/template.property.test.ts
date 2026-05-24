// Feature: github-actions-monorepo, Property 3: Template rendering substitution correctness
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { renderTemplate } from '../src/template';

/**
 * Validates: Requirements 5.7, 12.1, 12.4
 *
 * Property 3: Template rendering substitution correctness
 *
 * For any template string containing {{key}} placeholders and any
 * Record<string, string> variables object, renderTemplate SHALL produce
 * output where:
 * (a) every placeholder {{k}} where k exists in the variables is replaced with variables[k]
 * (b) every placeholder {{k}} where k does NOT exist in the variables remains as literal {{k}}
 * (c) all non-placeholder text is preserved unchanged
 */
describe('Property 3: Template rendering substitution correctness', () => {
  // Arbitrary for generating valid Handlebars identifier keys.
  // Keys must start with a letter to be valid Handlebars variable references
  // (numeric-leading identifiers are interpreted as literals by Handlebars).
  // We also avoid prototype property names (toString, constructor, etc.) that
  // Handlebars blocks access to for security reasons.
  const RESERVED_KEYS = new Set([
    'toString', 'valueOf', 'constructor', 'hasOwnProperty',
    'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString',
    '__proto__', '__defineGetter__', '__defineSetter__',
    '__lookupGetter__', '__lookupSetter__',
  ]);

  const wordKeyArb = fc
    .tuple(
      fc.char().filter((c) => /[a-zA-Z]/.test(c)),
      fc.stringOf(
        fc.char().filter((c) => /[a-zA-Z0-9_]/.test(c)),
        { minLength: 0, maxLength: 19 },
      ),
    )
    .map(([first, rest]) => first + rest)
    .filter((key) => !RESERVED_KEYS.has(key));

  // Arbitrary for generating Handlebars-safe values.
  // Excludes { } and \ characters to avoid Handlebars interpreting them as
  // triple-stash syntax, block expressions, or escape sequences.
  const safeValueArb = fc.stringOf(
    fc.char().filter((c) => c !== '{' && c !== '}' && c !== '\\'),
    { minLength: 0, maxLength: 50 },
  );

  // Arbitrary for generating Handlebars-safe non-placeholder text segments.
  // Excludes { } and \ characters to prevent Handlebars from misinterpreting
  // content as expressions or escape sequences.
  const plainTextArb = fc.stringOf(
    fc.char().filter((c) => c !== '{' && c !== '}' && c !== '\\'),
    { minLength: 0, maxLength: 30 },
  );

  it('all matched placeholders are replaced, unmatched remain, and non-placeholder text is preserved', () => {
    const templatePartsArb = fc.record({
      matchedKeys: fc.uniqueArray(wordKeyArb, { minLength: 0, maxLength: 5 }),
      unmatchedKeys: fc.uniqueArray(wordKeyArb, { minLength: 0, maxLength: 5 }),
      values: fc.array(safeValueArb, { minLength: 5, maxLength: 10 }),
      textSegments: fc.array(plainTextArb, { minLength: 1, maxLength: 8 }),
    });

    fc.assert(
      fc.property(templatePartsArb, ({ matchedKeys, unmatchedKeys, values, textSegments }) => {
        // Ensure unmatched keys don't overlap with matched keys
        const matchedSet = new Set(matchedKeys);
        const actualUnmatched = unmatchedKeys.filter((k) => !matchedSet.has(k));

        // Build the variables map from matched keys
        const variables: Record<string, string> = {};
        for (let i = 0; i < matchedKeys.length; i++) {
          variables[matchedKeys[i]] = values[i % values.length];
        }

        // Build a template by interleaving text segments with placeholders
        let template = '';
        const allPlaceholderKeys = [
          ...matchedKeys.map((k) => ({ key: k, matched: true })),
          ...actualUnmatched.map((k) => ({ key: k, matched: false })),
        ];

        // Interleave: textSegment, placeholder, textSegment, placeholder, ...
        for (let i = 0; i < allPlaceholderKeys.length; i++) {
          template += textSegments[i % textSegments.length];
          template += `{{${allPlaceholderKeys[i].key}}}`;
        }
        // Append trailing text
        template += textSegments[allPlaceholderKeys.length % textSegments.length];

        const result = renderTemplate(template, variables);

        // (a) Every matched placeholder {{k}} is replaced with variables[k]
        for (const key of matchedKeys) {
          const placeholder = `{{${key}}}`;
          // The placeholder should NOT appear in the result (it was replaced)
          // unless the replacement value itself contains the placeholder text
          if (!variables[key].includes(placeholder)) {
            expect(result).not.toContain(placeholder);
          }
        }

        // (b) Every unmatched placeholder {{k}} remains as literal {{k}}
        for (const key of actualUnmatched) {
          const placeholder = `{{${key}}}`;
          expect(result).toContain(placeholder);
        }

        // (c) All non-placeholder text is preserved unchanged
        // Rebuild expected output manually to verify
        let expected = '';
        for (let i = 0; i < allPlaceholderKeys.length; i++) {
          expected += textSegments[i % textSegments.length];
          const entry = allPlaceholderKeys[i];
          if (entry.matched) {
            expected += variables[entry.key];
          } else {
            expected += `{{${entry.key}}}`;
          }
        }
        expected += textSegments[allPlaceholderKeys.length % textSegments.length];

        expect(result).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });
});
