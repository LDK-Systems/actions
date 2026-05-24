import { getOctokit } from '@actions/github';

/**
 * Options for creating a GitHub release.
 */
export interface CreateReleaseOptions {
  token: string;
  owner: string;
  repo: string;
  tag: string;
  name: string;
  body: string;
  draft?: boolean;
  prerelease?: boolean;
}

/**
 * Result returned after creating a GitHub release.
 */
export interface CreateReleaseResult {
  id: number;
  url: string;
  htmlUrl: string;
}

/**
 * Creates a GitHub release with the specified parameters.
 * Defaults: draft=false, prerelease=false.
 * Throws on API errors (auth, network, conflict).
 * @param options - Release creation options
 * @returns The created release information
 */
export async function createRelease(options: CreateReleaseOptions): Promise<CreateReleaseResult> {
  const { token, owner, repo, tag, name, body, draft = false, prerelease = false } = options;

  const octokit = getOctokit(token);

  const response = await octokit.rest.repos.createRelease({
    owner,
    repo,
    tag_name: tag,
    name,
    body,
    draft,
    prerelease,
  });

  return {
    id: response.data.id,
    url: response.data.url,
    htmlUrl: response.data.html_url,
  };
}
