import * as core from '@actions/core';
import { releaseExists } from '@ldk-systems/lib';

/**
 * Main entry point for the check-release-version action.
 */
async function run(): Promise<void> {
  try {
    const version = core.getInput('version', { required: true });
    const repository = core.getInput('repository', { required: true });
    const token = core.getInput('token') || process.env.GITHUB_TOKEN || '';

    // Validate inputs — fail immediately on first invalid input (Req 3.4)
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

    // Token is NOT validated upfront (Req 3.6) — let API call fail if token is bad
    const exists = await releaseExists(token, owner, repo, version);

    core.setOutput('exists', exists.toString());
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

run();
