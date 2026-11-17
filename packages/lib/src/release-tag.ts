import { getOctokit } from '@actions/github';

/** Snapshot of the release and Git tag visible to the supplied GitHub token. */
export interface ReleaseLookup {
  tagExists: boolean;
  release?: {
    id: number;
    url: string;
    name: string;
    draft: boolean;
    prerelease: boolean;
  };
}

/**
 * Splits an owner/repository identifier, rejecting ambiguous paths.
 * @param repository - Repository in owner/repo format
 * @returns Owner and repository name
 */
export function parseRepository(repository: string): { owner: string; repo: string } {
  const parts = repository.trim().split('/');
  if (parts.length !== 2 || !/^[A-Za-z0-9-]+$/.test(parts[0]) ||
      !/^[A-Za-z0-9_.-]+$/.test(parts[1]) || ['.', '..'].includes(parts[1])) {
    throw new Error('Input "repository" must be in owner/repo format.');
  }
  return { owner: parts[0], repo: parts[1] };
}

/**
 * Forms one exact Git tag, with no automatic separator or fallback.
 * @param version - Effective MSBuild Version property
 * @param prefix - Literal release tag prefix (may be empty)
 * @returns Exact Git tag name
 */
export function createReleaseTag(version: string, prefix: string): string {
  if (!/^\d+(?:\.\d+){1,3}(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error('Expected a numeric .NET version, optionally with prerelease/build metadata.');
  }
  const tag = prefix + version;
  if (!/^[A-Za-z0-9_][A-Za-z0-9._/+\-]*$/.test(tag) || tag.includes('..') ||
      tag.split('/').some((part) => !part || part.startsWith('.') ||
        part.endsWith('.') || part.endsWith('.lock'))) {
    throw new Error('The release tag prefix and version do not form a supported Git tag.');
  }
  return tag;
}

/**
 * Looks for one exact release (including drafts visible to the token) and Git ref.
 * Lists releases rather than assuming a release-by-tag 404 also excludes drafts.
 * Authentication, repository access and non-404 ref errors are propagated.
 * @param token - GitHub API token, with repository contents read access
 * @param repository - Repository in owner/repo format
 * @param tag - Exact tag name
 * @returns Independent release and Git tag status
 */
export async function findReleaseByTag(
  token: string,
  repository: string,
  tag: string,
): Promise<ReleaseLookup> {
  if (!token) {
    throw new Error('A GitHub token is required.');
  }
  const { owner, repo } = parseRepository(repository);
  const octokit = getOctokit(token);
  let release: ReleaseLookup['release'];
  for await (const page of octokit.paginate.iterator(octokit.rest.repos.listReleases, {
    owner,
    repo,
    per_page: 100,
  })) {
    const match = page.data.find((item) => item.tag_name === tag);
    if (match) {
      release = {
        id: match.id,
        url: match.html_url,
        name: match.name ?? '',
        draft: match.draft,
        prerelease: match.prerelease,
      };
      break;
    }
  }

  let tagExists = false;
  try {
    const response = await octokit.rest.git.getRef({ owner, repo, ref: 'tags/' + tag });
    tagExists = response.data.ref === 'refs/tags/' + tag;
  } catch (error: unknown) {
    if (typeof error !== 'object' || error === null || !('status' in error) ||
        error.status !== 404) {
      throw error;
    }
  }
  return { tagExists, release };
}
