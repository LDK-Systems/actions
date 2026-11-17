import console from 'node:console';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const { workspaces } = JSON.parse(readFileSync('package.json', 'utf8'));
const actions = workspaces.filter((workspace) => existsSync(workspace + '/action.yml'));
const paths = actions.map((action) => action + '/dist');
for (const directory of paths) {
  const entrypoint = directory + '/index.js';
  const result = spawnSync('git', ['ls-files', '--error-unmatch', entrypoint], {
    stdio: 'ignore',
  });
  if (!existsSync(entrypoint) || result.status !== 0) {
    throw new Error('Missing committed ncc entrypoint: ' + entrypoint);
  }
}

const result = spawnSync(
  'git',
  ['status', '--porcelain', '--untracked-files=all', '--', ...paths],
  { encoding: 'utf8' },
);
if (result.status !== 0) {
  throw new Error('Unable to inspect generated action bundles: ' + result.stderr);
}
if (result.stdout.trim()) {
  console.error(result.stdout);
  throw new Error('Generated action bundles are stale. Run npm run build and commit dist.');
}
console.log('All committed ncc bundles are current.');
