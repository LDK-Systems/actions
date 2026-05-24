import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@actions/github', () => ({
  getOctokit: vi.fn(),
}));

import { getOctokit } from '@actions/github';
import { createRelease } from '../src/releases';

const mockGetOctokit = vi.mocked(getOctokit);

function createMockOctokit(response: { id: number; url: string; html_url: string }) {
  const mockCreateRelease = vi.fn().mockResolvedValue({
    data: response,
  });

  mockGetOctokit.mockReturnValue({
    rest: {
      repos: { createRelease: mockCreateRelease },
    },
  } as unknown as ReturnType<typeof getOctokit>);

  return mockCreateRelease;
}

describe('createRelease', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls octokit.rest.repos.createRelease with correct parameters', async () => {
    const mockCreate = createMockOctokit({
      id: 123,
      url: 'https://api.github.com/repos/owner/repo/releases/123',
      html_url: 'https://github.com/owner/repo/releases/tag/v1.0.0',
    });

    await createRelease({
      token: 'my-token',
      owner: 'owner',
      repo: 'repo',
      tag: 'v1.0.0',
      name: 'Release v1.0.0',
      body: 'Release notes content',
      draft: true,
      prerelease: true,
    });

    expect(mockGetOctokit).toHaveBeenCalledWith('my-token');
    expect(mockCreate).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      tag_name: 'v1.0.0',
      name: 'Release v1.0.0',
      body: 'Release notes content',
      draft: true,
      prerelease: true,
    });
  });

  it('passes default values for draft (false) and prerelease (false)', async () => {
    const mockCreate = createMockOctokit({
      id: 456,
      url: 'https://api.github.com/repos/owner/repo/releases/456',
      html_url: 'https://github.com/owner/repo/releases/tag/v2.0.0',
    });

    await createRelease({
      token: 'token',
      owner: 'owner',
      repo: 'repo',
      tag: 'v2.0.0',
      name: 'Release v2.0.0',
      body: 'Notes',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      tag_name: 'v2.0.0',
      name: 'Release v2.0.0',
      body: 'Notes',
      draft: false,
      prerelease: false,
    });
  });

  it('returns id, url, and htmlUrl from the API response', async () => {
    createMockOctokit({
      id: 789,
      url: 'https://api.github.com/repos/owner/repo/releases/789',
      html_url: 'https://github.com/owner/repo/releases/tag/v3.0.0',
    });

    const result = await createRelease({
      token: 'token',
      owner: 'owner',
      repo: 'repo',
      tag: 'v3.0.0',
      name: 'Release v3.0.0',
      body: 'Body text',
    });

    expect(result).toEqual({
      id: 789,
      url: 'https://api.github.com/repos/owner/repo/releases/789',
      htmlUrl: 'https://github.com/owner/repo/releases/tag/v3.0.0',
    });
  });

  it('propagates authentication errors', async () => {
    const mockCreate = vi.fn().mockRejectedValue(new Error('Bad credentials'));

    mockGetOctokit.mockReturnValue({
      rest: {
        repos: { createRelease: mockCreate },
      },
    } as unknown as ReturnType<typeof getOctokit>);

    await expect(
      createRelease({
        token: 'bad-token',
        owner: 'owner',
        repo: 'repo',
        tag: 'v1.0.0',
        name: 'Release',
        body: 'Notes',
      })
    ).rejects.toThrow('Bad credentials');
  });

  it('propagates network errors', async () => {
    const mockCreate = vi.fn().mockRejectedValue(new Error('Network error'));

    mockGetOctokit.mockReturnValue({
      rest: {
        repos: { createRelease: mockCreate },
      },
    } as unknown as ReturnType<typeof getOctokit>);

    await expect(
      createRelease({
        token: 'token',
        owner: 'owner',
        repo: 'repo',
        tag: 'v1.0.0',
        name: 'Release',
        body: 'Notes',
      })
    ).rejects.toThrow('Network error');
  });
});
