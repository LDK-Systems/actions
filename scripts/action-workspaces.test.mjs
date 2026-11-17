import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createActionFilters, getActionWorkspaces, selectActions } from './action-workspaces.mjs';

/**
 * Creates an isolated monorepo containing registered JavaScript actions and an internal library.
 * @param {string[]} workspaces - Root workspace declarations
 * @returns {{ root: string, cleanup: () => void }} Fixture and cleanup callback
 */
function fixture(workspaces) {
  const root = mkdtempSync(join(tmpdir(), 'ldk-actions-ci-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ workspaces }));
  for (const name of ['first-action', 'second-action', 'composite-action']) {
    const directory = join(root, name);
    mkdirSync(directory);
    const runtime = name === 'composite-action' ? 'composite' : 'node24';
    writeFileSync(join(directory, 'action.yml'), 'runs:\n  using: ' + runtime + '\n');
    writeFileSync(
      join(directory, 'package.json'),
      JSON.stringify({ private: true, scripts: { build: 'ncc build src/index.ts' } }),
    );
  }
  mkdirSync(join(root, 'packages', 'lib'), { recursive: true });
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('discovers only registered JavaScript actions, not internal libraries or composite actions', () => {
  const { root, cleanup } = fixture(['second-action', 'first-action', 'composite-action', 'packages/*']);
  try {
    assert.deepEqual(getActionWorkspaces(root), ['first-action', 'second-action']);
  } finally {
    cleanup();
  }
});

test('an unregistered JavaScript action fails instead of silently missing CI', () => {
  const { root, cleanup } = fixture(['first-action']);
  try {
    assert.throws(() => getActionWorkspaces(root), /Register JavaScript action.*second-action/);
  } finally {
    cleanup();
  }
});

test('filters include each action itself and transitive shared build inputs, but no other action', () => {
  const filters = createActionFilters(['first-action', 'second-action']);
  assert.deepEqual(Object.keys(filters), ['first-action', 'second-action']);
  assert.ok(filters['first-action'].includes('first-action/**'));
  assert.ok(!filters['first-action'].includes('second-action/**'));
  for (const filter of Object.values(filters)) {
    assert.ok(filter.includes('packages/**'));
    assert.ok(filter.includes('package-lock.json'));
    assert.ok(filter.includes('package.json'));
    assert.ok(filter.includes('.github/workflows/ci.yml'));
  }
  assert.deepEqual(createActionFilters([]), {});
});

test('selects all by default and rejects unknown or unsafe paths', () => {
  const actions = ['first-action', 'second-action'];
  assert.deepEqual(selectActions(actions, []), actions);
  assert.deepEqual(selectActions(actions, ['second-action', 'second-action']), ['second-action']);
  assert.throws(() => selectActions(actions, ['packages/lib']), /Unknown JavaScript action/);
  assert.throws(() => selectActions(actions, ['../outside']), /Unknown JavaScript action/);
});
