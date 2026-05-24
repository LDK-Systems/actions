import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as core from '@actions/core';
import fs from 'fs';

vi.mock('@actions/core');
vi.mock('fs');

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
