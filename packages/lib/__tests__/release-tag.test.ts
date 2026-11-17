import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getOctokit: vi.fn(),
  iterator: vi.fn(),
  listReleases: vi.fn(),
  getRef: vi.fn(),
}));

vi.mock('@actions/github', () => ({ getOctokit: mocks.getOctokit }));

import { createReleaseTag, findReleaseByTag, parseRepository } from '../src/release-tag';

describe('createReleaseTag', () => {
  it.each([
    ['1.2.3', 'v', 'v1.2.3'],
    ['1.2.3', '', '1.2.3'],
    ['1.2.3-preview.1+build.7', 'routing/v', 'routing/v1.2.3-preview.1+build.7'],
    ['1.2.3.4', 'worker-', 'worker-1.2.3.4'],
  ])('uses the literal prefix without fallback', (version, prefix, tag) => {
    expect(createReleaseTag(version, prefix)).toBe(tag);
  });

  it.each([
    ['not-version', 'v'],
    ['1.2.3', '../'],
    ['1.2.3', 'bad//'],
    ['1.2.3', 'bad prefix'],
    ['1.2.3', 'component.lock/'],
    ['1.2.3', '-'],
  ])('rejects invalid version or tag prefix', (version, prefix) => {
    expect(() => createReleaseTag(version, prefix)).toThrow();
  });
});

describe('parseRepository', () => {
  it('accepts owner/repo', () =>
    expect(parseRepository('LDK-Systems/actions')).toEqual({
      owner: 'LDK-Systems',
      repo: 'actions',
    }));
  it.each(['', 'owner', 'owner/a/b', 'owner/..', 'owner /repo'])('rejects %s', (repository) => {
    expect(() => parseRepository(repository)).toThrow();
  });
});

describe('findReleaseByTag', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getOctokit.mockReturnValue({
      paginate: { iterator: mocks.iterator },
      rest: { repos: { listReleases: mocks.listReleases }, git: { getRef: mocks.getRef } },
    });
    mocks.getRef.mockRejectedValue({ status: 404 });
  });

  it('matches exact tags on later pages, including a visible draft with no Git ref', async () => {
    mocks.iterator.mockImplementation(async function* () {
      yield { data: [{ tag_name: 'worker/v1.2.3' }, { tag_name: 'v1.2.3' }] };
      yield {
        data: [
          {
            tag_name: 'routing/v1.2.3',
            id: 123,
            html_url: 'https://github.com/example/repo/releases/tag/routing/v1.2.3',
            name: 'Routing',
            draft: true,
            prerelease: false,
          },
        ],
      };
    });

    expect(await findReleaseByTag('token', 'example/repo', 'routing/v1.2.3')).toEqual({
      tagExists: false,
      release: {
        id: 123,
        url: 'https://github.com/example/repo/releases/tag/routing/v1.2.3',
        name: 'Routing',
        draft: true,
        prerelease: false,
      },
    });
    expect(mocks.getRef).toHaveBeenCalledWith({
      owner: 'example',
      repo: 'repo',
      ref: 'tags/routing/v1.2.3',
    });
  });

  it('distinguishes a tag without a release', async () => {
    mocks.iterator.mockImplementation(async function* () {
      yield { data: [{ tag_name: 'v1.2.3' }] };
    });
    mocks.getRef.mockResolvedValue({ data: { ref: 'refs/tags/routing/v1.2.3' } });
    expect(await findReleaseByTag('token', 'example/repo', 'routing/v1.2.3')).toEqual({
      tagExists: true,
      release: undefined,
    });
  });

  it('returns absent only after a successful release lookup and missing ref', async () => {
    mocks.iterator.mockImplementation(async function* () {
      yield { data: [] };
    });
    expect(await findReleaseByTag('token', 'example/repo', 'v1.2.3')).toEqual({
      tagExists: false,
      release: undefined,
    });
  });

  it('propagates repository-access errors and non-404 ref errors', async () => {
    mocks.iterator.mockImplementation(() => {
      throw new Error('repository access denied');
    });
    await expect(findReleaseByTag('token', 'example/repo', 'v1.2.3')).rejects.toThrow('denied');

    mocks.iterator.mockImplementation(async function* () {
      yield { data: [] };
    });
    mocks.getRef.mockRejectedValue({ status: 403 });
    await expect(findReleaseByTag('token', 'example/repo', 'v1.2.3')).rejects.toEqual({
      status: 403,
    });
  });
});
