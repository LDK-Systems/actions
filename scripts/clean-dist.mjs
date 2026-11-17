import { existsSync, readFileSync, rmSync } from 'node:fs';

const { workspaces } = JSON.parse(readFileSync('package.json', 'utf8'));
for (const workspace of workspaces) {
  if (existsSync(workspace + '/action.yml')) {
    rmSync(workspace + '/dist', { recursive: true, force: true });
  }
}
