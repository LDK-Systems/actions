import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateDotnetVersion, parseDotnetVersion } from '../src/dotnet-version';

describe('parseDotnetVersion', () => {
  it('reads evaluated values without reconstructing Version', () => {
    expect(
      parseDotnetVersion(
        JSON.stringify({
          Properties: {
            Version: '2.4.0-preview.1',
            VersionPrefix: '1.0.0',
            VersionSuffix: 'preview.1',
            PackageVersion: '2.4.0-preview.2',
          },
        }),
      ),
    ).toEqual({
      version: '2.4.0-preview.1',
      versionPrefix: '1.0.0',
      versionSuffix: 'preview.1',
      packageVersion: '2.4.0-preview.2',
    });
  });

  it('preserves the effective version when optional properties are absent', () => {
    expect(parseDotnetVersion('{"Properties":{"Version":"1.2.3"}}')).toEqual({
      version: '1.2.3',
      versionPrefix: '',
      versionSuffix: '',
      packageVersion: '',
    });
  });

  it.each(['not json', '{}', 'null', '{"Properties":[]}', '{"Properties":{"Version":""}}'])(
    'rejects invalid MSBuild output: %s',
    (output) => {
      expect(() => parseDotnetVersion(output)).toThrow();
    },
  );
});

describe('evaluateDotnetVersion input validation', () => {
  it('rejects paths outside the workspace and unsafe property values', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ldk-msbuild-'));
    try {
      const workspace = join(root, 'workspace');
      await mkdir(workspace);
      const outside = join(root, 'Other.csproj');
      const inside = join(workspace, 'Example.csproj');
      await writeFile(outside, '<Project />');
      await writeFile(inside, '<Project />');
      await expect(
        evaluateDotnetVersion({ workspace, projectFile: outside, configuration: 'Release' }),
      ).rejects.toThrow('inside');
      await expect(
        evaluateDotnetVersion({
          workspace,
          projectFile: inside,
          configuration: 'Release;Version=9.9.9',
        }),
      ).rejects.toThrow('Invalid configuration');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
