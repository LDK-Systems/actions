import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getInput: vi.fn(),
  setOutput: vi.fn(),
  setSecret: vi.fn(),
  setFailed: vi.fn(),
  info: vi.fn(),
  evaluateDotnetVersion: vi.fn(),
  findReleaseByTag: vi.fn(),
  createReleaseTag: vi.fn(),
  completion: undefined as Promise<void> | undefined,
}));

vi.mock('@actions/core', () => ({
  getInput: mocks.getInput,
  setOutput: mocks.setOutput,
  setSecret: mocks.setSecret,
  setFailed: mocks.setFailed,
  info: mocks.info,
}));

vi.mock('@ldk-systems/lib', () => ({
  evaluateDotnetVersion: mocks.evaluateDotnetVersion,
  findReleaseByTag: mocks.findReleaseByTag,
  createReleaseTag: mocks.createReleaseTag,
  runAction: (fn: () => Promise<void>) => {
    mocks.completion = fn().catch((error: Error) => {
      mocks.setFailed(error.message);
    });
  },
}));

describe('check-dotnet-release', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    const inputs: Record<string, string> = {
      'project-file': 'src/Routing/Routing.csproj',
      configuration: 'Release',
      'target-framework': 'net10.0',
      'release-tag-prefix': 'routing/v',
      repository: 'example/repo',
      token: 'test-token',
    };
    mocks.getInput.mockImplementation((key: string) => inputs[key] ?? '');
    mocks.evaluateDotnetVersion.mockResolvedValue({
      version: '2.4.0',
      versionPrefix: '2.4.0',
      versionSuffix: '',
      packageVersion: '2.4.0',
    });
    mocks.createReleaseTag.mockReturnValue('routing/v2.4.0');
  });

  it('outputs metadata and the matching release details', async () => {
    mocks.findReleaseByTag.mockResolvedValue({
      tagExists: true,
      release: {
        id: 42,
        url: 'https://example.test/release',
        name: 'Routing',
        draft: false,
        prerelease: true,
      },
    });
    await import('../src/index');
    await mocks.completion;

    expect(mocks.createReleaseTag).toHaveBeenCalledWith('2.4.0', 'routing/v');
    expect(mocks.evaluateDotnetVersion).toHaveBeenCalledWith(
      expect.objectContaining({ configuration: 'Release', targetFramework: 'net10.0' }),
    );
    expect(mocks.findReleaseByTag).toHaveBeenCalledWith(
      'test-token',
      'example/repo',
      'routing/v2.4.0',
    );
    expect(Object.fromEntries(mocks.setOutput.mock.calls)).toEqual({
      version: '2.4.0',
      'version-prefix': '2.4.0',
      'version-suffix': '',
      'package-version': '2.4.0',
      tag: 'routing/v2.4.0',
      exists: 'true',
      'tag-exists': 'true',
      'release-id': '42',
      'release-url': 'https://example.test/release',
      'release-name': 'Routing',
      draft: 'false',
      prerelease: 'true',
    });
    expect(mocks.setSecret).toHaveBeenCalledWith('test-token');
    expect(mocks.setFailed).not.toHaveBeenCalled();
  });

  it('sets exists=false on a tag-only match and clears release-only outputs', async () => {
    mocks.findReleaseByTag.mockResolvedValue({ tagExists: true });
    await import('../src/index');
    await mocks.completion;
    expect(mocks.setOutput).toHaveBeenCalledWith('exists', 'false');
    expect(mocks.setOutput).toHaveBeenCalledWith('tag-exists', 'true');
    expect(mocks.setOutput).toHaveBeenCalledWith('release-id', '');
    expect(mocks.setOutput).toHaveBeenCalledWith('release-url', '');
    expect(mocks.setOutput).toHaveBeenCalledWith('draft', '');
  });

  it('fails instead of incorrectly reporting that a release is missing on API failure', async () => {
    mocks.findReleaseByTag.mockRejectedValue(new Error('API denied'));
    await import('../src/index');
    await mocks.completion;
    expect(mocks.setFailed).toHaveBeenCalledWith('API denied');
    expect(mocks.setOutput).not.toHaveBeenCalled();
  });
});
