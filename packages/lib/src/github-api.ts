import { getOctokit } from '@actions/github';

/**
 * Information about a GitHub release.
 */
export interface ReleaseInfo {
  id: number;
  tagName: string;
  name: string;
  url: string;
}

/**
 * Fetches all releases for a repository.
 * Throws on authentication or network errors.
 * @param token - GitHub API token for authentication
 * @param owner - Repository owner
 * @param repo - Repository name
 * @returns Array of release information objects
 */
export async function getReleases(
  token: string,
  owner: string,
  repo: string
): Promise<ReleaseInfo[]> {
  const octokit = getOctokit(token);

  const releases: ReleaseInfo[] = [];
  let page = 1;

  while (true) {
    const response = await octokit.rest.repos.listReleases({
      owner,
      repo,
      per_page: 100,
      page,
    });

    for (const release of response.data) {
      releases.push({
        id: release.id,
        tagName: release.tag_name,
        name: release.name ?? '',
        url: release.html_url,
      });
    }

    if (response.data.length < 100) {
      break;
    }

    page++;
  }

  return releases;
}

/**
 * Checks whether a release with the given tag exists.
 * Checks both the raw version and v-prefixed version.
 * Returns true if either tag form matches an existing release.
 * @param token - GitHub API token for authentication
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param version - Version string to check
 * @returns Whether a release with the given version exists
 */
export async function releaseExists(
  token: string,
  owner: string,
  repo: string,
  version: string
): Promise<boolean> {
  const releases = await getReleases(token, owner, repo);

  const vPrefixed = version.startsWith('v') ? version : `v${version}`;
  const raw = version.startsWith('v') ? version.slice(1) : version;

  return releases.some(
    (release) => release.tagName === raw || release.tagName === vPrefixed
  );
}
