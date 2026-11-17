import * as core from '@actions/core';
import {
  createReleaseTag,
  evaluateDotnetVersion,
  findReleaseByTag,
  readNpmVersion,
  releaseExists,
  releaseLookupOutputs,
  runAction,
} from '@ldk-systems/lib';

/**
 * Preserves the original explicit-version lookup, including raw and v-prefixed tags.
 */
async function runExplicitVersion(): Promise<void> {
  const version = core.getInput('version', { required: true });
  const repository = core.getInput('repository', { required: true });
  const token = core.getInput('token') || process.env.GITHUB_TOKEN || '';

  if (!version.trim()) {
    core.setFailed('Input "version" must not be empty');
    return;
  }

  const repoParts = repository.split('/');
  if (repoParts.length !== 2 || !repoParts[0].trim() || !repoParts[1].trim()) {
    core.setFailed(
      'Input "repository" must be in owner/repo format (two non-empty strings separated by a single "/")',
    );
    return;
  }

  const [owner, repo] = repoParts;

  const exists = await releaseExists(token, owner, repo, version);

  core.setOutput('exists', exists.toString());
}

/**
 * Resolves project metadata using the selected ecosystem and checks one exact release tag.
 * @param source - Version source selected by the workflow
 */
async function runFileVersion(source: 'dotnet' | 'npm'): Promise<void> {
  if (core.getInput('version')) {
    throw new Error('Input "version" is only supported with version-source: explicit.');
  }
  const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
  const path = core.getInput('project-file', { required: source === 'dotnet' });
  const prefix = core.getInput('release-tag-prefix');
  const repository = core.getInput('repository') || process.env.GITHUB_REPOSITORY || '';
  const token = core.getInput('token') || process.env.GITHUB_TOKEN || '';
  if (!token) {
    throw new Error('A GitHub token is required.');
  }
  core.setSecret(token);

  const metadata =
    source === 'dotnet'
      ? await evaluateDotnetVersion({
          workspace,
          projectFile: path,
          configuration: core.getInput('configuration') || 'Release',
          targetFramework: core.getInput('target-framework') || undefined,
        })
      : await readNpmVersion(workspace, path || 'package.json').then((pkg) => ({
          version: pkg.version,
          versionPrefix: '',
          versionSuffix: '',
          packageVersion: pkg.version,
          packageName: pkg.packageName,
        }));

  const tag = createReleaseTag(metadata.version, prefix);
  const result = await findReleaseByTag(token, repository, tag);
  const outputs = {
    'version-source': source,
    version: metadata.version,
    'version-prefix': metadata.versionPrefix,
    'version-suffix': metadata.versionSuffix,
    'package-version': metadata.packageVersion,
    'package-name': 'packageName' in metadata ? metadata.packageName : '',
    ...releaseLookupOutputs(tag, result),
  };
  for (const [name, value] of Object.entries(outputs)) {
    core.setOutput(name, value);
  }
  core.info(
    result.release ? 'A matching GitHub release exists.' : 'No matching GitHub release is visible.',
  );
}

/** Dispatches the action according to the version-source input. */
async function run(): Promise<void> {
  const source = core.getInput('version-source') || 'explicit';
  if (source === 'explicit') {
    await runExplicitVersion();
  } else if (source === 'dotnet' || source === 'npm') {
    await runFileVersion(source);
  } else {
    throw new Error('Input "version-source" must be explicit, dotnet, or npm.');
  }
}

runAction(run);
