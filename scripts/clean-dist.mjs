import { rmSync } from 'node:fs';
import process from 'node:process';
import { getActionWorkspaces, selectActions } from './action-workspaces.mjs';

const actions = selectActions(getActionWorkspaces(), process.argv.slice(2));
for (const action of actions) {
  rmSync(action + '/dist', { recursive: true, force: true });
}
