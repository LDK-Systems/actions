import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@actions/github', () => ({
  getOctokit: vi.fn(),
}));

import { getOctokit } from '@actions/github';
import { getReleases, releaseExists } from '../src/github-api';

const mockGetOctokit = vi.mocked(getOctokit);

function createMockOctokit(releases: Array<{ id: number; tag_name: string; name: string | null; html_url: string }>) {
  const listReleases = vi.fn().mockResolvedValue({
    data: releases,
  });

  mockGetOctokit.mockReturnValue({
    rest: {
      repos: { listReleases },
    },
  } as unknown as ReturnType<typeof getOctokit>);

  return listReleases;
}

describe('getReleases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches releases and maps them to ReleaseInfo', async () => {
    createMockOctokit([
      { id: 1, tag_name: 'v1.0.0', name: 'Release 1.0.0', html_url: 'https://github.com/owner/repo/releases/tag/v1.0.0' },
      { id: 2, tag_name: '2.0.0', name: null, html_url: 'https://github.com/owner/repo/releases/tag/2.0.0' },
    ]);

    const result = await getReleases('token', 'owner', 'repo');

    expect(result).toEqual([
      { id: 1, tagName: 'v1.0.0', name: 'Release 1.0.0', url: 'https://github.com/owner/repo/releases/tag/v1.0.0' },
      { id: 2, tagName: '2.0.0', name: '', url: 'https://github.com/owner/repo/releases/tag/2.0.0' },
    ]);
  });

  it('returns empty array when no releases exist', async () => {
    createMockOctokit([]);

    const result = await getReleases('token', 'owner', 'repo');

    expect(result).toEqual([]);
  });

  it('paginates when there are more than 100 releases', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      tag_name: `v${i + 1}.0.0`,
      name: `Release ${i + 1}`,
      html_url: `https://github.com/owner/repo/releases/tag/v${i + 1}.0.0`,
    }));
    const page2 = [
      { id: 101, tag_name: 'v101.0.0', name: 'Release 101', html_url: 'https://github.com/owner/repo/releases/tag/v101.0.0' },
    ];

    const listReleases = vi.fn()
      .mockResolvedValueOnce({ data: page1 })
      .mockResolvedValueOnce({ data: page2 });

    mockGetOctokit.mockReturnValue({
      rest: {
        repos: { listReleases },
      },
    } as unknown as ReturnType<typeof getOctokit>);

    const result = await getReleases('token', 'owner', 'repo');

    expect(result).toHaveLength(101);
    expect(listReleases).toHaveBeenCalledTimes(2);
    expect(listReleases).toHaveBeenCalledWith({ owner: 'owner', repo: 'repo', per_page: 100, page: 1 });
    expect(listReleases).toHaveBeenCalledWith({ owner: 'owner', repo: 'repo', per_page: 100, page: 2 });
  });

  it('propagates authentication errors (Req 5.8)', async () => {
    const listReleases = vi.fn().mockRejectedValue(new Error('Bad credentials'));

    mockGetOctokit.mockReturnValue({
      rest: {
        repos: { listReleases },
      },
    } as unknown as ReturnType<typeof getOctokit>);

    await expect(getReleases('bad-token', 'owner', 'repo')).rejects.toThrow('Bad credentials');
  });

  it('propagates network errors (Req 5.8)', async () => {
    const listReleases = vi.fn().mockRejectedValue(new Error('Network error'));

    mockGetOctokit.mockReturnValue({
      rest: {
        repos: { listReleases },
      },
    } as unknown as ReturnType<typeof getOctokit>);

    await expect(getReleases('token', 'owner', 'repo')).rejects.toThrow('Network error');
  });

  it('passes the token to getOctokit', async () => {
    createMockOctokit([]);

    await getReleases('my-secret-token', 'owner', 'repo');

    expect(mockGetOctokit).toHaveBeenCalledWith('my-secret-token');
  });
});

describe('releaseExists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when exact version tag matches', async () => {
    createMockOctokit([
      { id: 1, tag_name: '1.0.0', name: 'Release 1.0.0', html_url: 'https://github.com/owner/repo/releases/tag/1.0.0' },
    ]);

    const result = await releaseExists('token', 'owner', 'repo', '1.0.0');

    expect(result).toBe(true);
  });

  it('returns true when v-prefixed version tag matches', async () => {
    createMockOctokit([
      { id: 1, tag_name: 'v1.0.0', name: 'Release 1.0.0', html_url: 'https://github.com/owner/repo/releases/tag/v1.0.0' },
    ]);

    const result = await releaseExists('token', 'owner', 'repo', '1.0.0');

    expect(result).toBe(true);
  });

  it('returns true when version input has v-prefix and tag has v-prefix', async () => {
    createMockOctokit([
      { id: 1, tag_name: 'v2.0.0', name: 'Release', html_url: 'https://github.com/owner/repo/releases/tag/v2.0.0' },
    ]);

    const result = await releaseExists('token', 'owner', 'repo', 'v2.0.0');

    expect(result).toBe(true);
  });

  it('returns true when version input has v-prefix and tag does not', async () => {
    createMockOctokit([
      { id: 1, tag_name: '2.0.0', name: 'Release', html_url: 'https://github.com/owner/repo/releases/tag/2.0.0' },
    ]);

    const result = await releaseExists('token', 'owner', 'repo', 'v2.0.0');

    expect(result).toBe(true);
  });

  it('returns false when no matching release exists', async () => {
    createMockOctokit([
      { id: 1, tag_name: 'v1.0.0', name: 'Release 1.0.0', html_url: 'https://github.com/owner/repo/releases/tag/v1.0.0' },
    ]);

    const result = await releaseExists('token', 'owner', 'repo', '2.0.0');

    expect(result).toBe(false);
  });

  it('returns false when release list is empty', async () => {
    createMockOctokit([]);

    const result = await releaseExists('token', 'owner', 'repo', '1.0.0');

    expect(result).toBe(false);
  });

  it('propagates errors from getReleases (Req 5.8)', async () => {
    const listReleases = vi.fn().mockRejectedValue(new Error('Not Found'));

    mockGetOctokit.mockReturnValue({
      rest: {
        repos: { listReleases },
      },
    } as unknown as ReturnType<typeof getOctokit>);

    await expect(releaseExists('token', 'owner', 'repo', '1.0.0')).rejects.toThrow('Not Found');
  });
});
