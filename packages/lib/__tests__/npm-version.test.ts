import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseNpmVersion, readNpmVersion } from '../src/npm-version';

describe('parseNpmVersion', () => {
  it.each(['0.0.0', '1.2.3', '1.2.3-beta.2+build.007', '2.0.0-01alpha'])(
    'preserves exact SemVer text %s',
    (version) => {
      expect(parseNpmVersion(JSON.stringify({ name: '@ldk/ui', version }))).toEqual({
        version,
        packageName: '@ldk/ui',
      });
    },
  );

  it('allows unnamed private packages and a BOM', () => {
    expect(parseNpmVersion('\uFEFF{"version":"1.2.3","private":true}')).toEqual({
      version: '1.2.3',
      packageName: '',
    });
  });

  it.each([
    'v1.2.3',
    '1.2',
    '01.2.3',
    '1.2.3-01',
    '1.2.3-',
    '1.2.3+',
    '1.2.3-beta..2',
    '1.2.3\n',
    '^1.2.3',
    ' 1.2.3',
    '',
    123,
    null,
  ])('rejects non-SemVer version %s', (version) => {
    expect(() => parseNpmVersion(JSON.stringify({ version }))).toThrow('valid SemVer');
  });

  it.each(['{', '[]', 'null', '42', '{}'])(
    'rejects malformed or missing manifest data: %s',
    (data) => {
      expect(() => parseNpmVersion(data)).toThrow();
    },
  );
});

describe('readNpmVersion', () => {
  it('reads the selected workspace package, not the root package or lockfile', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ldk-npm-version-'));
    try {
      const workspace = join(root, 'checkout');
      const pkg = join(workspace, 'packages', 'ui');
      await mkdir(pkg, { recursive: true });
      await writeFile(join(workspace, 'package.json'), '{"version":"1.0.0"}');
      await writeFile(join(pkg, 'package.json'), '{"name":"@ldk/ui","version":"4.5.6"}');
      await writeFile(join(pkg, 'package-lock.json'), '{"version":"0.0.1"}');
      expect(await readNpmVersion(workspace, 'packages/ui/package.json')).toEqual({
        version: '4.5.6',
        packageName: '@ldk/ui',
      });
      expect(await readNpmVersion(workspace, 'package.json')).toEqual({
        version: '1.0.0',
        packageName: '',
      });
      await expect(readNpmVersion(workspace, 'packages/ui/package-lock.json')).rejects.toThrow(
        'Expected a package.json',
      );
      await expect(readNpmVersion(workspace, 'missing/package.json')).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects package manifests outside the checkout, including symlink targets', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ldk-npm-version-'));
    try {
      const workspace = join(root, 'checkout');
      await mkdir(workspace);
      const outside = join(root, 'package.json');
      await writeFile(outside, '{"version":"1.2.3"}');
      await expect(readNpmVersion(workspace, '../package.json')).rejects.toThrow('inside');
      if (process.platform !== 'win32') {
        await symlink(outside, join(workspace, 'package.json'));
        await expect(readNpmVersion(workspace, 'package.json')).rejects.toThrow('inside');
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
