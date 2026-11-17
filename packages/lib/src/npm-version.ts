import { readFile, realpath, stat } from 'node:fs/promises';
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';

/** Version metadata read from an npm package manifest. */
export interface NpmVersion {
  version: string;
  packageName: string;
}

/**
 * Parses a package.json document and validates its version against SemVer 2.0.
 * @param content - Package manifest JSON text
 * @returns Package version and optional package name
 */
export function parseNpmVersion(content: string): NpmVersion {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('Invalid package.json: expected valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid package.json: expected a JSON object.');
  }
  const { version, name } = parsed as Record<string, unknown>;
  const semver =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
  const match = typeof version === 'string' ? semver.exec(version) : null;
  if (!match || match[0] !== version || match[4]?.split('.').some((id) => /^0\d+$/.test(id))) {
    throw new Error('package.json must contain a valid SemVer version.');
  }
  return {
    version: match[0],
    packageName: typeof name === 'string' ? name : '',
  };
}

/**
 * Reads the selected package's manifest without installing dependencies or executing scripts.
 * Resolves symlinks before checking that the file is inside the checkout.
 * @param workspace - Checkout root
 * @param packageFile - Path to package.json relative to the checkout
 * @returns Package version metadata
 */
export async function readNpmVersion(workspace: string, packageFile: string): Promise<NpmVersion> {
  const root = await realpath(workspace);
  const manifest = await realpath(resolve(root, packageFile));
  const relativePath = relative(root, manifest);
  if (isAbsolute(relativePath) || relativePath === '..' || relativePath.startsWith('..' + sep)) {
    throw new Error('Package file must be inside the checked-out workspace.');
  }
  if (basename(manifest) !== 'package.json' || !(await stat(manifest)).isFile()) {
    throw new Error('Expected a package.json file.');
  }
  return parseNpmVersion(await readFile(manifest, 'utf8'));
}
