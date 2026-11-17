import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getInput: vi.fn(),
  setOutput: vi.fn(),
  setSecret: vi.fn(),
  setFailed: vi.fn(),
  info: vi.fn(),
  readNpmVersion: vi.fn(),
  evaluateDotnetVersion: vi.fn(),
  findReleaseByTag: vi.fn(),
  releaseExists: vi.fn(),
  completion: undefined as Promise<void> | undefined,
}));

vi.mock('@actions/core', () => ({
  getInput: mocks.getInput,
  setOutput: mocks.setOutput,
  setSecret: mocks.setSecret,
  setFailed: mocks.setFailed,
  info: mocks.info,
}));

vi.mock('@ldk-systems/lib', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ldk-systems/lib')>()),
  evaluateDotnetVersion: mocks.evaluateDotnetVersion,
  readNpmVersion: mocks.readNpmVersion,
  findReleaseByTag: mocks.findReleaseByTag,
  releaseExists: mocks.releaseExists,
  runAction: (fn: () => Promise<void>) => {
    mocks.completion = fn().catch((error: Error) => {
      mocks.setFailed(error.message);
    });
  },
}));

function setupInputs(inputs: Record<string, string>) {
  mocks.getInput.mockImplementation((name: string) => inputs[name] ?? '');
}

async function execute() {
  await import('../src/index');
  await mocks.completion;
  return Object.fromEntries(mocks.setOutput.mock.calls);
}

describe('check-release-version file sources', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    mocks.evaluateDotnetVersion.mockResolvedValue({
      version: '2.4.0-preview.1',
      versionPrefix: '2.4.0',
      versionSuffix: 'preview.1',
      packageVersion: '2.4.0-preview.2',
    });
    mocks.readNpmVersion.mockResolvedValue({
      version: '3.2.1-beta.2+build.7',
      packageName: '@ldk/ui',
    });
    mocks.findReleaseByTag.mockResolvedValue({ tagExists: false });
  });

  const common = { repository: 'example/repo', token: 'test-token' };

  it('evaluates .NET properties and checks the exact component tag', async () => {
    setupInputs({
      ...common,
      'version-source': 'dotnet',
      'project-file': 'src/Routing/Routing.csproj',
      configuration: 'Release',
      'target-framework': 'net10.0',
      'release-tag-prefix': 'routing/v',
    });
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
    expect(await execute()).toEqual({
      'version-source': 'dotnet',
      version: '2.4.0-preview.1',
      'version-prefix': '2.4.0',
      'version-suffix': 'preview.1',
      'package-version': '2.4.0-preview.2',
      'package-name': '',
      tag: 'routing/v2.4.0-preview.1',
      exists: 'true',
      'tag-exists': 'true',
      'release-id': '42',
      'release-url': 'https://example.test/release',
      'release-name': 'Routing',
      draft: 'false',
      prerelease: 'true',
    });
    expect(mocks.evaluateDotnetVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        projectFile: 'src/Routing/Routing.csproj',
        configuration: 'Release',
        targetFramework: 'net10.0',
      }),
    );
    expect(mocks.findReleaseByTag).toHaveBeenCalledWith(
      'test-token',
      'example/repo',
      'routing/v2.4.0-preview.1',
    );
    expect(mocks.readNpmVersion).not.toHaveBeenCalled();
    expect(mocks.releaseExists).not.toHaveBeenCalled();
    expect(mocks.setSecret).toHaveBeenCalledWith('test-token');
    expect(mocks.setFailed).not.toHaveBeenCalled();
  });

  it('reads a scoped npm workspace package and distinguishes a tag without a release', async () => {
    setupInputs({
      ...common,
      'version-source': 'npm',
      'project-file': 'packages/ui/package.json',
      'release-tag-prefix': '@ldk/ui@',
    });
    mocks.findReleaseByTag.mockResolvedValue({ tagExists: true });
    expect(await execute()).toEqual({
      'version-source': 'npm',
      version: '3.2.1-beta.2+build.7',
      'version-prefix': '',
      'version-suffix': '',
      'package-version': '3.2.1-beta.2+build.7',
      'package-name': '@ldk/ui',
      tag: '@ldk/ui@3.2.1-beta.2+build.7',
      exists: 'false',
      'tag-exists': 'true',
      'release-id': '',
      'release-url': '',
      'release-name': '',
      draft: '',
      prerelease: '',
    });
    expect(mocks.readNpmVersion).toHaveBeenCalledWith(
      expect.any(String),
      'packages/ui/package.json',
    );
    expect(mocks.evaluateDotnetVersion).not.toHaveBeenCalled();
    expect(mocks.findReleaseByTag).toHaveBeenCalledWith(
      'test-token',
      'example/repo',
      '@ldk/ui@3.2.1-beta.2+build.7',
    );
  });

  it('defaults npm to root package.json and permits an empty tag prefix', async () => {
    setupInputs({ ...common, 'version-source': 'npm' });
    const result = await execute();
    expect(mocks.readNpmVersion).toHaveBeenCalledWith(expect.any(String), 'package.json');
    expect(result.tag).toBe('3.2.1-beta.2+build.7');
    expect(result.exists).toBe('false');
    expect(result['tag-exists']).toBe('false');
  });

  it('retains original explicit version behaviour when the flag is omitted', async () => {
    setupInputs({ ...common, version: 'v1.2.3' });
    mocks.releaseExists.mockResolvedValue(true);
    expect(await execute()).toEqual({ exists: 'true' });
    expect(mocks.releaseExists).toHaveBeenCalledWith('test-token', 'example', 'repo', 'v1.2.3');
    expect(mocks.evaluateDotnetVersion).not.toHaveBeenCalled();
    expect(mocks.readNpmVersion).not.toHaveBeenCalled();
  });

  it.each(['unknown', 'DOTNET', 'python'])('fails for unsupported source %s', async (source) => {
    setupInputs({ ...common, 'version-source': source });
    expect(await execute()).toEqual({});
    expect(mocks.setFailed).toHaveBeenCalledWith(expect.stringContaining('version-source'));
    expect(mocks.findReleaseByTag).not.toHaveBeenCalled();
  });

  it('rejects a conflicting explicit version in file mode', async () => {
    setupInputs({ ...common, 'version-source': 'npm', version: '1.0.0' });
    expect(await execute()).toEqual({});
    expect(mocks.setFailed).toHaveBeenCalledWith(expect.stringContaining('explicit'));
    expect(mocks.readNpmVersion).not.toHaveBeenCalled();
  });

  it('fails rather than returning exists=false if version resolution fails', async () => {
    setupInputs({ ...common, 'version-source': 'npm' });
    mocks.readNpmVersion.mockRejectedValue(new Error('Invalid package.json'));
    expect(await execute()).toEqual({});
    expect(mocks.setFailed).toHaveBeenCalledWith('Invalid package.json');
    expect(mocks.findReleaseByTag).not.toHaveBeenCalled();
  });

  it('fails rather than returning exists=false if the GitHub API fails', async () => {
    setupInputs({ ...common, 'version-source': 'npm' });
    mocks.findReleaseByTag.mockRejectedValue(new Error('API denied'));
    expect(await execute()).toEqual({});
    expect(mocks.setFailed).toHaveBeenCalledWith('API denied');
  });
});
