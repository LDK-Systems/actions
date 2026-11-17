import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

/** Root-level paths that may affect the generated bundle of any action. */
export const sharedPaths = [
  'packages/**',
  'package.json',
  'package-lock.json',
  '.npmrc',
  'tsconfig*.json',
  'vitest*.ts',
  'eslint.config.*',
  '.prettier*',
  '.gitignore',
  '.gitattributes',
  'scripts/**',
  '.github/actions/setup-js/**',
  '.github/workflows/ci.yml',
];

/**
 * Discovers registered, root-level JavaScript action workspaces.
 * Non-action workspaces (such as packages/*) are not build-matrix entries.
 * @param {string} root - Repository root
 * @returns {string[]} Sorted action directory names
 */
export function getActionWorkspaces(root = process.cwd()) {
  const { workspaces } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  if (!Array.isArray(workspaces) || !workspaces.every((item) => typeof item === 'string')) {
    throw new Error('Expected a workspace array in the root package.json.');
  }
  const actions = [];
  const names = new Set(workspaces);
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name.startsWith('.')) {
      continue;
    }
    const directory = join(root, entry.name);
    const metadata = ['action.yml', 'action.yaml'].find((name) => existsSync(join(directory, name)));
    if (!metadata) {
      continue;
    }
    const action = readFileSync(join(directory, metadata), 'utf8');
    if (!/^\s*using:\s*['"]?node\d+['"]?\s*(?:#.*)?$/m.test(action)) {
      continue;
    }
    if (!/^[a-z][a-z0-9-]*$/.test(entry.name) || entry.name === 'changes') {
      throw new Error('Unsupported JavaScript action directory: ' + entry.name);
    }
    if (!names.has(entry.name)) {
      throw new Error('Register JavaScript action in root workspaces: ' + entry.name);
    }
    const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
    if (manifest.private !== true || typeof manifest.scripts?.build !== 'string') {
      throw new Error('Action workspace must be private and define a build script: ' + entry.name);
    }
    actions.push(entry.name);
  }
  return actions.sort();
}

/**
 * Narrows the action list to exact workspace arguments, or returns all with no arguments.
 * @param {string[]} actions - Known action directories
 * @param {string[]} requested - Optional explicit action directories
 * @returns {string[]} Validated selection
 */
export function selectActions(actions, requested) {
  if (requested.length === 0) {
    return actions;
  }
  for (const name of requested) {
    if (!actions.includes(name)) {
      throw new Error('Unknown JavaScript action workspace: ' + name);
    }
  }
  return [...new Set(requested)];
}

/**
 * Generates a dorny/paths-filter mapping with one key per action.
 * Each action inherits the shared dependency and build configuration globs.
 * @param {string[]} actions - JavaScript action directory names
 * @returns {Record<string, string[]>} Filter mapping
 */
export function createActionFilters(actions) {
  return Object.fromEntries(actions.map((name) => [name, [name + '/**', ...sharedPaths]]));
}
