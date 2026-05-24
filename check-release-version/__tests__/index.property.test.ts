// Feature: github-actions-monorepo, Property 4: Release existence detection correctness
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

vi.mock('@actions/github', () => ({
  getOctokit: vi.fn(),
}));

import { getOctokit } from '@actions/github';
import { releaseExists } from '@ldk-systems/lib';

const mockGetOctokit = vi.mocked(getOctokit);

/**
 * Validates: Requirements 3.2, 3.3
 *
 * Property 4: Release existence detection correctness
 *
 * For any version string and any set of release tags in a repository,
 * releaseExists SHALL return true if and only if the set contains a tag
 * matching either the exact version string or the version string prefixed with 'v'.
 */
describe('Property 4: Release existence detection correctness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** Arbitrary for version strings without leading 'v' */
  const rawVersionArb = fc.stringOf(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789.-+'.split('')),
    { minLength: 1, maxLength: 15 },
  );

  /** Arbitrary for version strings that may or may not have leading 'v' */
  const versionArb = fc.oneof(
    rawVersionArb,
    rawVersionArb.map((v) => `v${v}`),
  );

  /** Arbitrary for release tag strings */
  const tagArb = fc.stringOf(
    fc.constantFrom(
      ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-+_v'.split(''),
    ),
    { minLength: 1, maxLength: 20 },
  );

  function setupMockReleases(tags: string[]) {
    const listReleases = vi.fn().mockResolvedValue({
      data: tags.map((tag, i) => ({
        id: i + 1,
        tag_name: tag,
        name: `Release ${tag}`,
        html_url: `https://github.com/owner/repo/releases/tag/${tag}`,
      })),
    });

    mockGetOctokit.mockReturnValue({
      rest: {
        repos: { listReleases },
      },
    } as unknown as ReturnType<typeof getOctokit>);
  }

  /**
   * Computes the expected result of releaseExists:
   * Given a version, it should return true iff the tag set contains
   * either the raw version (without 'v' prefix) or the v-prefixed version.
   */
  function expectedResult(version: string, tags: string[]): boolean {
    const vPrefixed = version.startsWith('v') ? version : `v${version}`;
    const raw = version.startsWith('v') ? version.slice(1) : version;
    return tags.some((tag) => tag === raw || tag === vPrefixed);
  }

  it('releaseExists returns true iff tag set contains exact version or v-prefixed version', async () => {
    await fc.assert(
      fc.asyncProperty(
        versionArb,
        fc.array(tagArb, { minLength: 0, maxLength: 10 }),
        async (version, tags) => {
          setupMockReleases(tags);

          const result = await releaseExists('token', 'owner', 'repo', version);
          const expected = expectedResult(version, tags);

          expect(result).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });
});
