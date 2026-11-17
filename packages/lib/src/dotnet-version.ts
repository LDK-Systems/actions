import { execFile } from 'node:child_process';
import { realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Effective, evaluation-time MSBuild project metadata. */
export interface DotnetVersion {
  version: string;
  versionPrefix: string;
  versionSuffix: string;
  packageVersion: string;
}

/** Options for evaluation of a trusted, checked-out SDK-style project. */
export interface DotnetVersionOptions {
  projectFile: string;
  workspace: string;
  configuration: string;
  targetFramework?: string;
}

/**
 * Parses the JSON returned by a multiple-property MSBuild query.
 * @param output - MSBuild standard output
 * @returns Effective version metadata
 */
export function parseDotnetVersion(output: string): DotnetVersion {
  let parsed: unknown;
  try {
    parsed = JSON.parse(output.trim().replace(/^\uFEFF/, ''));
  } catch {
    throw new Error(
      'MSBuild did not return valid property JSON. Check the SDK and project evaluation.',
    );
  }

  const properties = (parsed as { Properties?: unknown } | null)?.Properties;
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    throw new Error('MSBuild property JSON is missing Properties.');
  }
  const values = properties as Record<string, unknown>;
  const version = values.Version;
  if (typeof version !== 'string' || !version.trim()) {
    throw new Error('MSBuild did not resolve a non-empty Version property.');
  }
  return {
    version: version.trim(),
    versionPrefix: typeof values.VersionPrefix === 'string' ? values.VersionPrefix.trim() : '',
    versionSuffix: typeof values.VersionSuffix === 'string' ? values.VersionSuffix.trim() : '',
    packageVersion: typeof values.PackageVersion === 'string' ? values.PackageVersion.trim() : '',
  };
}

/**
 * Evaluates project properties without running a build target.
 * Only evaluate trusted checked-out projects: MSBuild imports and evaluation are executable-capable.
 * @param options - Project path, workspace and evaluation properties
 * @returns Evaluation-time version metadata
 */
export async function evaluateDotnetVersion(options: DotnetVersionOptions): Promise<DotnetVersion> {
  const workspace = await realpath(options.workspace);
  const project = await realpath(resolve(workspace, options.projectFile));
  const fromWorkspace = relative(workspace, project);
  if (isAbsolute(fromWorkspace) || fromWorkspace === '..' || fromWorkspace.startsWith('..' + sep)) {
    throw new Error('Project file must be inside the checked-out workspace.');
  }
  if (
    !['.csproj', '.fsproj', '.vbproj'].includes(extname(project).toLowerCase()) ||
    !(await stat(project)).isFile()
  ) {
    throw new Error('Expected a .csproj, .fsproj or .vbproj file.');
  }

  // MSBuild property arguments allow separators; accept only simple values to avoid switch/property injection.
  const safeValue = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
  if (
    !safeValue.test(options.configuration) ||
    (options.targetFramework && !safeValue.test(options.targetFramework))
  ) {
    throw new Error('Invalid configuration or target-framework input.');
  }
  const args = [
    'msbuild',
    project,
    '-nologo',
    '-getProperty:Version,VersionPrefix,VersionSuffix,PackageVersion',
    '-p:Configuration=' + options.configuration,
  ];
  if (options.targetFramework) {
    args.push('-p:TargetFramework=' + options.targetFramework);
  }
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync('dotnet', args, {
      cwd: dirname(project),
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
      shell: false,
      env: { ...process.env, DOTNET_NOLOGO: 'true', DOTNET_CLI_TELEMETRY_OPTOUT: 'true' },
    }));
  } catch {
    throw new Error(
      'MSBuild evaluation failed. Ensure the selected SDK (8+), imports and project are available.',
    );
  }
  return parseDotnetVersion(stdout);
}
