import * as core from '@actions/core';
import { releaseExists, runAction } from '@ldk-systems/lib';

/**
 * Main entry point for the check-release-version action.
 */
async function run(): Promise<void> {
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

runAction(run);
