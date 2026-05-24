import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseXmlElement } from '../src/xml';

// Feature: github-actions-monorepo, Property 2: XML element extraction returns correct text content

/**
 * Validates: Requirements 5.4
 *
 * Property 2: XML element extraction returns correct text content
 * For any well-formed XML document string and any tag name, if the document
 * contains an element with that tag name, parseXmlElement SHALL return the text
 * content of that element; if the document does not contain an element with that
 * tag name, it SHALL return undefined.
 */

/** Arbitrary for valid XML tag names: starts with letter/underscore, followed by letters/digits/hyphens/underscores/dots */
const xmlTagNameArb = fc
  .tuple(
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_'.split('')), {
      minLength: 1,
      maxLength: 1,
    }),
    fc.stringOf(
      fc.constantFrom(
        ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.'.split('')
      ),
      { minLength: 0, maxLength: 10 }
    )
  )
  .map(([first, rest]) => first + rest);

/** Arbitrary for alphanumeric text content */
const textContentArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')),
  { minLength: 1, maxLength: 20 }
);

/** Arbitrary for a pair of distinct tag names */
const distinctTagPairArb = fc
  .tuple(xmlTagNameArb, xmlTagNameArb)
  .filter(([a, b]) => a !== b);

describe('Property 2: XML element extraction returns correct text content', () => {
  it('parseXmlElement returns correct text content for existing elements and undefined for non-existing', () => {
    fc.assert(
      fc.property(
        distinctTagPairArb,
        textContentArb,
        ([tagName, nonExistingTag], content) => {
          // Build a well-formed XML document containing the tag
          const xml = `<root><${tagName}>${content}</${tagName}></root>`;

          // Verify parseXmlElement returns the content for the existing tag
          const result = parseXmlElement(xml, tagName);
          expect(result).toBe(content);

          // Verify undefined is returned for a tag not in the document
          const missingResult = parseXmlElement(xml, nonExistingTag);
          expect(missingResult).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});
