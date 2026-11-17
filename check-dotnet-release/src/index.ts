import * as core from '@actions/core';
import {
  createReleaseTag,
  evaluateDotnetVersion,
  findReleaseByTag,
  releaseLookupOutputs,
  runAction,
} from '@ldk-systems/lib';

/**
 * Evaluates the project and publishes read-only release lookup outputs.
 */
async function run(): Promise<void> {
  const projectFile = core.getInput('project-file', { required: true });
  const configuration = core.getInput('configuration') || 'Release';
  const targetFramework = core.getInput('target-framework') || undefined;
  const prefix = core.getInput('release-tag-prefix');
  const repository = core.getInput('repository') || process.env.GITHUB_REPOSITORY || '';
  const token = core.getInput('token') || process.env.GITHUB_TOKEN || '';
  if (!token) {
    throw new Error('A GitHub token is required.');
  }
  core.setSecret(token);

  const metadata = await evaluateDotnetVersion({
    projectFile,
    configuration,
    targetFramework,
    workspace: process.env.GITHUB_WORKSPACE || process.cwd(),
  });
  const tag = createReleaseTag(metadata.version, prefix);
  const result = await findReleaseByTag(token, repository, tag);
  core.setOutput('version', metadata.version);
  core.setOutput('version-prefix', metadata.versionPrefix);
  core.setOutput('version-suffix', metadata.versionSuffix);
  core.setOutput('package-version', metadata.packageVersion);
  for (const [name, value] of Object.entries(releaseLookupOutputs(tag, result))) {
    core.setOutput(name, value);
  }
  core.info(
    result.release ? 'A matching GitHub release exists.' : 'No matching GitHub release is visible.',
  );
}

runAction(run);
