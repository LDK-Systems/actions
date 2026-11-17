import console from 'node:console';
import process from 'node:process';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { getActionWorkspaces, selectActions } from './action-workspaces.mjs';

const actions = selectActions(getActionWorkspaces(), process.argv.slice(2));
if (actions.length === 0) {
  throw new Error('No JavaScript action workspaces found.');
}
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
  throw new Error('Generated action bundles are stale. Rebuild and commit the complete dist.');
}
console.log('All selected committed ncc bundles are current: ' + actions.join(', '));
