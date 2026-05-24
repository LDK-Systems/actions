import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@actions/core', () => ({
  getInput: vi.fn(),
  setOutput: vi.fn(),
  setFailed: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('@ldk-systems/lib', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ldk-systems/lib')>();
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
import * as fs from 'fs';

const mockedCore = vi.mocked(core);
const mockedFs = vi.mocked(fs);

describe('extract-dotnet-version', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('extracts <Version> element correctly', async () => {
    const csproj = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <Version>1.2.3</Version>
  </PropertyGroup>
</Project>`;

    mockedCore.getInput.mockReturnValue('test.csproj');
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(csproj);

    await import('../src/index');

    expect(mockedCore.setOutput).toHaveBeenCalledWith('version', '1.2.3');
    expect(mockedCore.setOutput).toHaveBeenCalledWith('version-prefix', '');
    expect(mockedCore.setOutput).toHaveBeenCalledWith('version-suffix', '');
    expect(mockedCore.setFailed).not.toHaveBeenCalled();
  });

  it('constructs version from <VersionPrefix> and <VersionSuffix>', async () => {
    const csproj = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <VersionPrefix>2.0.0</VersionPrefix>
    <VersionSuffix>beta.1</VersionSuffix>
  </PropertyGroup>
</Project>`;

    mockedCore.getInput.mockReturnValue('test.csproj');
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(csproj);

    await import('../src/index');

    expect(mockedCore.setOutput).toHaveBeenCalledWith('version', '2.0.0-beta.1');
    expect(mockedCore.setOutput).toHaveBeenCalledWith('version-prefix', '2.0.0');
    expect(mockedCore.setOutput).toHaveBeenCalledWith('version-suffix', 'beta.1');
    expect(mockedCore.setFailed).not.toHaveBeenCalled();
  });

  it('extracts <VersionPrefix> alone as version', async () => {
    const csproj = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <VersionPrefix>3.1.0</VersionPrefix>
  </PropertyGroup>
</Project>`;

    mockedCore.getInput.mockReturnValue('test.csproj');
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(csproj);

    await import('../src/index');

    expect(mockedCore.setOutput).toHaveBeenCalledWith('version', '3.1.0');
    expect(mockedCore.setOutput).toHaveBeenCalledWith('version-prefix', '3.1.0');
    expect(mockedCore.setOutput).toHaveBeenCalledWith('version-suffix', '');
    expect(mockedCore.setFailed).not.toHaveBeenCalled();
  });

  it('<Version> takes precedence over prefix/suffix', async () => {
    const csproj = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <Version>5.0.0</Version>
    <VersionPrefix>4.0.0</VersionPrefix>
    <VersionSuffix>rc.1</VersionSuffix>
  </PropertyGroup>
</Project>`;

    mockedCore.getInput.mockReturnValue('test.csproj');
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(csproj);

    await import('../src/index');

    expect(mockedCore.setOutput).toHaveBeenCalledWith('version', '5.0.0');
    expect(mockedCore.setFailed).not.toHaveBeenCalled();
  });

  it('fails when file does not exist', async () => {
    mockedCore.getInput.mockReturnValue('missing.csproj');
    mockedFs.existsSync.mockReturnValue(false);

    await import('../src/index');

    expect(mockedCore.setFailed).toHaveBeenCalledWith('File not found: missing.csproj');
    expect(mockedCore.setOutput).not.toHaveBeenCalled();
  });

  it('fails when no version properties present', async () => {
    const csproj = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
</Project>`;

    mockedCore.getInput.mockReturnValue('test.csproj');
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(csproj);

    await import('../src/index');

    expect(mockedCore.setFailed).toHaveBeenCalledWith(
      'No version information found in test.csproj',
    );
    expect(mockedCore.setOutput).not.toHaveBeenCalled();
  });

  it('fails on invalid XML', async () => {
    mockedCore.getInput.mockReturnValue('test.csproj');
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue('this is not xml at all');

    await import('../src/index');

    expect(mockedCore.setFailed).toHaveBeenCalledWith('File is not valid XML: test.csproj');
    expect(mockedCore.setOutput).not.toHaveBeenCalled();
  });
});
