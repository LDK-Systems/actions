import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@actions/core', () => ({
  getInput: vi.fn(),
  setOutput: vi.fn(),
  setFailed: vi.fn(),
}));

vi.mock('@actions/github', () => ({
  getOctokit: vi.fn(),
}));

vi.mock('@ldk-systems/lib', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ldk-systems/lib')>();
  // Import the mocked core to use the same instance
  const { setFailed } = await import('@actions/core');
  return {
    ...actual,
    runAction: (fn: () => Promise<void>) => {
      fn().catch((error: unknown) => {
        setFailed(error instanceof Error ? error.message : 'An unexpected error occurred');
      });
    },
  };
});

import * as core from '@actions/core';
import { getOctokit } from '@actions/github';

const mockGetInput = vi.mocked(core.getInput);
const mockSetOutput = vi.mocked(core.setOutput);
const mockSetFailed = vi.mocked(core.setFailed);
const mockGetOctokit = vi.mocked(getOctokit);

function setupInputs(inputs: Record<string, string>) {
  mockGetInput.mockImplementation((name: string) => inputs[name] ?? '');
}

function setupMockReleases(
  releases: Array<{ id: number; tag_name: string; name: string | null; html_url: string }>,
) {
  const listReleases = vi.fn().mockResolvedValue({ data: releases });
  mockGetOctokit.mockReturnValue({
    rest: {
      repos: { listReleases },
    },
  } as unknown as ReturnType<typeof getOctokit>);
  return listReleases;
}

describe('check-release-version action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('outputs true when release exists', () => {
    it('sets exists output to true when release tag matches version', async () => {
      setupInputs({ version: '1.0.0', repository: 'owner/repo', token: 'test-token' });
      setupMockReleases([
        {
          id: 1,
          tag_name: '1.0.0',
          name: 'Release 1.0.0',
          html_url: 'https://github.com/owner/repo/releases/tag/1.0.0',
        },
      ]);

      await import('../src/index');

      expect(mockSetOutput).toHaveBeenCalledWith('exists', 'true');
      expect(mockSetFailed).not.toHaveBeenCalled();
    });

    it('sets exists output to true when release tag matches v-prefixed version', async () => {
      setupInputs({ version: '2.0.0', repository: 'owner/repo', token: 'test-token' });
      setupMockReleases([
        {
          id: 1,
          tag_name: 'v2.0.0',
          name: 'Release 2.0.0',
          html_url: 'https://github.com/owner/repo/releases/tag/v2.0.0',
        },
      ]);

      await import('../src/index');

      expect(mockSetOutput).toHaveBeenCalledWith('exists', 'true');
    });
  });

  describe('outputs false when release does not exist', () => {
    it('sets exists output to false when no matching release exists', async () => {
      setupInputs({ version: '3.0.0', repository: 'owner/repo', token: 'test-token' });
      setupMockReleases([
        {
          id: 1,
          tag_name: 'v1.0.0',
          name: 'Release 1.0.0',
          html_url: 'https://github.com/owner/repo/releases/tag/v1.0.0',
        },
      ]);

      await import('../src/index');

      expect(mockSetOutput).toHaveBeenCalledWith('exists', 'false');
      expect(mockSetFailed).not.toHaveBeenCalled();
    });

    it('sets exists output to false when release list is empty', async () => {
      setupInputs({ version: '1.0.0', repository: 'owner/repo', token: 'test-token' });
      setupMockReleases([]);

      await import('../src/index');

      expect(mockSetOutput).toHaveBeenCalledWith('exists', 'false');
    });
  });

  describe('handles version with and without v prefix', () => {
    it('finds release when input has v prefix and tag has v prefix', async () => {
      setupInputs({ version: 'v1.0.0', repository: 'owner/repo', token: 'test-token' });
      setupMockReleases([
        {
          id: 1,
          tag_name: 'v1.0.0',
          name: 'Release',
          html_url: 'https://github.com/owner/repo/releases/tag/v1.0.0',
        },
      ]);

      await import('../src/index');

      expect(mockSetOutput).toHaveBeenCalledWith('exists', 'true');
    });

    it('finds release when input has v prefix and tag does not', async () => {
      setupInputs({ version: 'v1.0.0', repository: 'owner/repo', token: 'test-token' });
      setupMockReleases([
        {
          id: 1,
          tag_name: '1.0.0',
          name: 'Release',
          html_url: 'https://github.com/owner/repo/releases/tag/1.0.0',
        },
      ]);

      await import('../src/index');

      expect(mockSetOutput).toHaveBeenCalledWith('exists', 'true');
    });

    it('finds release when input has no v prefix and tag has v prefix', async () => {
      setupInputs({ version: '1.0.0', repository: 'owner/repo', token: 'test-token' });
      setupMockReleases([
        {
          id: 1,
          tag_name: 'v1.0.0',
          name: 'Release',
          html_url: 'https://github.com/owner/repo/releases/tag/v1.0.0',
        },
      ]);

      await import('../src/index');

      expect(mockSetOutput).toHaveBeenCalledWith('exists', 'true');
    });

    it('finds release when input has no v prefix and tag has no v prefix', async () => {
      setupInputs({ version: '1.0.0', repository: 'owner/repo', token: 'test-token' });
      setupMockReleases([
        {
          id: 1,
          tag_name: '1.0.0',
          name: 'Release',
          html_url: 'https://github.com/owner/repo/releases/tag/1.0.0',
        },
      ]);

      await import('../src/index');

      expect(mockSetOutput).toHaveBeenCalledWith('exists', 'true');
    });
  });

  describe('fails on empty version input', () => {
    it('calls setFailed when version is empty string', async () => {
      setupInputs({ version: '', repository: 'owner/repo', token: 'test-token' });

      await import('../src/index');

      expect(mockSetFailed).toHaveBeenCalledWith('Input "version" must not be empty');
      expect(mockSetOutput).not.toHaveBeenCalled();
    });

    it('calls setFailed when version is whitespace only', async () => {
      setupInputs({ version: '   ', repository: 'owner/repo', token: 'test-token' });

      await import('../src/index');

      expect(mockSetFailed).toHaveBeenCalledWith('Input "version" must not be empty');
      expect(mockSetOutput).not.toHaveBeenCalled();
    });
  });

  describe('fails on invalid repository format', () => {
    it('calls setFailed when repository has no slash', async () => {
      setupInputs({ version: '1.0.0', repository: 'invalid-repo', token: 'test-token' });

      await import('../src/index');

      expect(mockSetFailed).toHaveBeenCalledWith(expect.stringContaining('owner/repo format'));
      expect(mockSetOutput).not.toHaveBeenCalled();
    });

    it('calls setFailed when repository has multiple slashes', async () => {
      setupInputs({ version: '1.0.0', repository: 'owner/repo/extra', token: 'test-token' });

      await import('../src/index');

      expect(mockSetFailed).toHaveBeenCalledWith(expect.stringContaining('owner/repo format'));
      expect(mockSetOutput).not.toHaveBeenCalled();
    });

    it('calls setFailed when repository has empty owner', async () => {
      setupInputs({ version: '1.0.0', repository: '/repo', token: 'test-token' });

      await import('../src/index');

      expect(mockSetFailed).toHaveBeenCalledWith(expect.stringContaining('owner/repo format'));
      expect(mockSetOutput).not.toHaveBeenCalled();
    });

    it('calls setFailed when repository has empty repo name', async () => {
      setupInputs({ version: '1.0.0', repository: 'owner/', token: 'test-token' });

      await import('../src/index');

      expect(mockSetFailed).toHaveBeenCalledWith(expect.stringContaining('owner/repo format'));
      expect(mockSetOutput).not.toHaveBeenCalled();
    });
  });

  describe('fails on GitHub API errors', () => {
    it('calls setFailed when API returns an error', async () => {
      setupInputs({ version: '1.0.0', repository: 'owner/repo', token: 'test-token' });
      const listReleases = vi.fn().mockRejectedValue(new Error('Bad credentials'));
      mockGetOctokit.mockReturnValue({
        rest: {
          repos: { listReleases },
        },
      } as unknown as ReturnType<typeof getOctokit>);

      await import('../src/index');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockSetFailed).toHaveBeenCalledWith('Bad credentials');
    });

    it('calls setFailed when API returns a network error', async () => {
      setupInputs({ version: '1.0.0', repository: 'owner/repo', token: 'test-token' });
      const listReleases = vi.fn().mockRejectedValue(new Error('Network error'));
      mockGetOctokit.mockReturnValue({
        rest: {
          repos: { listReleases },
        },
      } as unknown as ReturnType<typeof getOctokit>);

      await import('../src/index');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockSetFailed).toHaveBeenCalledWith('Network error');
    });

    it('calls setFailed with generic message for non-Error throws', async () => {
      setupInputs({ version: '1.0.0', repository: 'owner/repo', token: 'test-token' });
      const listReleases = vi.fn().mockRejectedValue('string error');
      mockGetOctokit.mockReturnValue({
        rest: {
          repos: { listReleases },
        },
      } as unknown as ReturnType<typeof getOctokit>);

      await import('../src/index');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockSetFailed).toHaveBeenCalledWith('An unexpected error occurred');
    });
  });
});
