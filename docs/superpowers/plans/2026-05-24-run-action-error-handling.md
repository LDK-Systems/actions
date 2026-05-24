# runAction Error Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize action error handling in a single `runAction` utility exported from `@ldk-systems/lib`, and apply it consistently across all four actions.

**Architecture:** A new `runAction(fn)` function in `packages/lib/src/run-action.ts` calls the provided async function and attaches a `.catch()` to handle any rejection via `core.setFailed` with a consistent message. Each action's `run()` body loses its outer `try/catch`; operation-specific inner `try/catch` blocks remain. The bare `run()` call at the bottom of each action is replaced with `runAction(run)`.

**Tech Stack:** TypeScript, `@actions/core`, Vitest, `@ldk-systems/lib` workspace alias.

---

### Task 1: Implement `runAction` in `packages/lib` (TDD)

**Files:**
- Create: `packages/lib/src/run-action.ts`
- Modify: `packages/lib/src/index.ts`
- Create: `packages/lib/__tests__/run-action.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/lib/__tests__/run-action.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@actions/core', () => ({
  setFailed: vi.fn(),
}));

import * as core from '@actions/core';
import { runAction } from '../src/run-action';

const mockSetFailed = vi.mocked(core.setFailed);

describe('runAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not call setFailed when fn resolves successfully', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    runAction(fn);
    await Promise.resolve();
    expect(mockSetFailed).not.toHaveBeenCalled();
  });

  it('calls setFailed with error.message when fn rejects with an Error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    runAction(fn);
    await Promise.resolve();
    expect(mockSetFailed).toHaveBeenCalledWith('boom');
  });

  it('calls setFailed with fallback message when fn rejects with a non-Error value', async () => {
    const fn = vi.fn().mockRejectedValue('string rejection');
    runAction(fn);
    await Promise.resolve();
    expect(mockSetFailed).toHaveBeenCalledWith('An unexpected error occurred');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run --project packages/lib
```

Expected: FAIL — `Cannot find module '../src/run-action'`

- [ ] **Step 3: Create `packages/lib/src/run-action.ts`**

```ts
import * as core from '@actions/core';

/**
 * Wraps an action's main function, ensuring all errors are reported via core.setFailed.
 */
export function runAction(fn: () => Promise<void>): void {
  fn().catch((error: unknown) => {
    core.setFailed(error instanceof Error ? error.message : 'An unexpected error occurred');
  });
}
```

- [ ] **Step 4: Export `runAction` from `packages/lib/src/index.ts`**

Add this line to the existing exports in `packages/lib/src/index.ts`:

```ts
export { runAction } from './run-action';
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run --project packages/lib
```

Expected: All tests pass, including the three new `runAction` tests.

- [ ] **Step 6: Commit**

```bash
git add packages/lib/src/run-action.ts packages/lib/src/index.ts packages/lib/__tests__/run-action.test.ts
git commit -m "feat(lib): add runAction wrapper for consistent action error handling"
```

---

### Task 2: Update `check-release-version`

**Files:**
- Modify: `check-release-version/src/index.ts`

- [ ] **Step 1: Replace the file content**

The complete new content of `check-release-version/src/index.ts`:

```ts
import * as core from '@actions/core';
import { releaseExists, runAction } from '@ldk-systems/lib';

/**
 * Main entry point for the check-release-version action.
 */
async function run(): Promise<void> {
  const version = core.getInput('version', { required: true });
  const repository = core.getInput('repository', { required: true });
  const token = core.getInput('token') || process.env.GITHUB_TOKEN || '';

  if (!version.trim()) {
    core.setFailed('Input "version" must not be empty');
    return;
  }

  const repoParts = repository.split('/');
  if (repoParts.length !== 2 || !repoParts[0].trim() || !repoParts[1].trim()) {
    core.setFailed(
      'Input "repository" must be in owner/repo format (two non-empty strings separated by a single "/")',
    );
    return;
  }

  const [owner, repo] = repoParts;

  const exists = await releaseExists(token, owner, repo, version);

  core.setOutput('exists', exists.toString());
}

runAction(run);
```

- [ ] **Step 2: Run the action's tests**

```bash
npx vitest run --project check-release-version
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add check-release-version/src/index.ts
git commit -m "refactor(check-release-version): use runAction for error handling"
```

---

### Task 3: Update `extract-dotnet-version`

**Files:**
- Modify: `extract-dotnet-version/src/index.ts`

- [ ] **Step 1: Replace the file content**

The complete new content of `extract-dotnet-version/src/index.ts`:

```ts
import * as core from '@actions/core';
import { parseXmlElement, runAction } from '@ldk-systems/lib';
import { readFileSync, existsSync } from 'fs';

/**
 * Main entry point for the extract-dotnet-version action.
 */
async function run(): Promise<void> {
  const projectFile = core.getInput('project-file', { required: true });

  if (!existsSync(projectFile)) {
    core.setFailed(`File not found: ${projectFile}`);
    return;
  }

  const content = readFileSync(projectFile, 'utf-8');

  let version: string | undefined;
  let versionPrefix: string | undefined;
  let versionSuffix: string | undefined;

  try {
    version = parseXmlElement(content, 'Version');
    versionPrefix = parseXmlElement(content, 'VersionPrefix');
    versionSuffix = parseXmlElement(content, 'VersionSuffix');
  } catch {
    core.setFailed(`File is not valid XML: ${projectFile}`);
    return;
  }

  if (version === undefined && versionPrefix === undefined && versionSuffix === undefined) {
    core.setFailed(`No version information found in ${projectFile}`);
    return;
  }

  let resolvedVersion: string;

  if (version !== undefined) {
    resolvedVersion = version;
  } else if (versionPrefix !== undefined && versionSuffix !== undefined) {
    resolvedVersion = `${versionPrefix}-${versionSuffix}`;
  } else if (versionPrefix !== undefined) {
    resolvedVersion = versionPrefix;
  } else {
    resolvedVersion = '';
  }

  core.setOutput('version', resolvedVersion);
  core.setOutput('version-prefix', versionPrefix ?? '');
  core.setOutput('version-suffix', versionSuffix ?? '');
}

runAction(run);
```

- [ ] **Step 2: Run the action's tests**

```bash
npx vitest run --project extract-dotnet-version
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add extract-dotnet-version/src/index.ts
git commit -m "refactor(extract-dotnet-version): use runAction for error handling"
```

---

### Task 4: Update `generate-release-notes`

**Files:**
- Modify: `generate-release-notes/src/index.ts`

- [ ] **Step 1: Replace the file content**

The complete new content of `generate-release-notes/src/index.ts`:

```ts
import * as core from '@actions/core';
import { renderTemplate, createRelease, runAction } from '@ldk-systems/lib';
import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';

/**
 * Collects environment variables prefixed with RELEASE_VAR_,
 * strips the prefix, and lowercases the remainder as the variable key.
 *
 * @returns An object mapping lowercased variable names to their values
 */
function collectReleaseVarEnv(): Record<string, string> {
  const vars: Record<string, string> = {};
  const prefix = 'RELEASE_VAR_';
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(prefix) && value !== undefined) {
      const varKey = key.slice(prefix.length).toLowerCase();
      vars[varKey] = value;
    }
  }
  return vars;
}

/**
 * Resolves the template string based on precedence:
 * 1. Inline `template` input (highest priority)
 * 2. `template-file` input (read from file path)
 * 3. Default bundled template (lowest priority)
 *
 * @param templateInput - Inline template string from action input
 * @param templateFileInput - File path from action input
 * @returns The resolved template string
 * @throws Error if template-file is provided but the file does not exist
 */
function resolveTemplate(templateInput: string, templateFileInput: string): string {
  if (templateInput) {
    return templateInput;
  }

  if (templateFileInput) {
    const resolvedPath = resolve(templateFileInput);
    if (!existsSync(resolvedPath)) {
      throw new Error(`Template file not found: ${templateFileInput}`);
    }
    return readFileSync(resolvedPath, 'utf-8');
  }

  const defaultTemplatePath = join(__dirname, '..', 'default-template.hbs');
  return readFileSync(defaultTemplatePath, 'utf-8');
}

/**
 * Main entry point for the generate-release-notes action.
 */
async function run(): Promise<void> {
  const templateInput = core.getInput('template');
  const templateFileInput = core.getInput('template-file');
  const templateVarsRaw = core.getInput('template-vars') || '{}';
  const version = core.getInput('version', { required: true });
  const repository = core.getInput('repository', { required: true });
  const token = core.getInput('token') || process.env.GITHUB_TOKEN || '';

  if (!version) {
    core.setFailed('Input "version" must not be empty');
    return;
  }

  const repoPattern = /^[^/]+\/[^/]+$/;
  if (!repoPattern.test(repository)) {
    core.setFailed(
      'Input "repository" must be in owner/repo format (two non-empty strings separated by exactly one "/")',
    );
    return;
  }

  let inputVars: Record<string, string>;
  try {
    const parsed: unknown = JSON.parse(templateVarsRaw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      core.setFailed('Input "template-vars" must be a JSON object');
      return;
    }
    inputVars = parsed as Record<string, string>;
  } catch {
    core.setFailed('Input "template-vars" is not valid JSON');
    return;
  }

  let template: string;
  try {
    template = resolveTemplate(templateInput, templateFileInput);
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : 'Failed to resolve template');
    return;
  }

  const envVars = collectReleaseVarEnv();
  const templateVars: Record<string, string> = { ...envVars, ...inputVars };

  let body: string;
  try {
    body = renderTemplate(template, templateVars);
  } catch (error) {
    core.setFailed(
      error instanceof Error ? `Template syntax error: ${error.message}` : 'Template rendering failed due to a syntax error',
    );
    return;
  }

  const [owner, repo] = repository.split('/');
  const result = await createRelease({
    token,
    owner,
    repo,
    tag: version,
    name: version,
    body,
    draft: false,
    prerelease: false,
  });

  core.setOutput('release-url', result.htmlUrl);
  core.setOutput('release-notes', body);
}

runAction(run);
```

- [ ] **Step 2: Run the action's tests**

```bash
npx vitest run --project generate-release-notes
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add generate-release-notes/src/index.ts
git commit -m "refactor(generate-release-notes): use runAction for error handling"
```

---

### Task 5: Update `render-template`

**Files:**
- Modify: `render-template/src/index.ts`

- [ ] **Step 1: Replace the file content**

The complete new content of `render-template/src/index.ts`:

```ts
import * as core from '@actions/core';
import { renderTemplate, runAction } from '@ldk-systems/lib';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Resolves the template string from inputs using precedence:
 * 1. Inline `template` input (highest priority)
 * 2. `template-file` input (read from file path)
 *
 * @param templateInput - Inline template string from action input
 * @param templateFileInput - File path from action input
 * @returns The resolved template string
 * @throws Error if template-file is provided but the file does not exist, or if neither input is provided
 */
function resolveTemplate(templateInput: string, templateFileInput: string): string {
  if (templateInput) {
    return templateInput;
  }

  if (templateFileInput) {
    const resolvedPath = resolve(templateFileInput);
    if (!existsSync(resolvedPath)) {
      throw new Error(`Template file not found: ${templateFileInput}`);
    }
    return readFileSync(resolvedPath, 'utf-8');
  }

  throw new Error('Either "template" or "template-file" input must be provided');
}

/**
 * Main entry point for the render-template action.
 */
async function run(): Promise<void> {
  const templateInput = core.getInput('template');
  const templateFileInput = core.getInput('template-file');
  const templateVarsRaw = core.getInput('template-vars') || '{}';

  let templateVars: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(templateVarsRaw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      core.setFailed('Input "template-vars" must be a JSON object');
      return;
    }
    templateVars = parsed as Record<string, unknown>;
  } catch {
    core.setFailed('Input "template-vars" is not valid JSON');
    return;
  }

  let template: string;
  try {
    template = resolveTemplate(templateInput, templateFileInput);
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : 'Failed to resolve template');
    return;
  }

  let result: string;
  try {
    result = renderTemplate(template, templateVars);
  } catch (error) {
    core.setFailed(
      error instanceof Error ? `Template syntax error: ${error.message}` : 'Template rendering failed',
    );
    return;
  }

  core.setOutput('result', result);
}

runAction(run);
```

- [ ] **Step 2: Run the action's tests**

```bash
npx vitest run --project render-template
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add render-template/src/index.ts
git commit -m "refactor(render-template): use runAction for error handling"
```

---

### Task 6: Full verification and build

**Files:**
- Modify: `dist/index.js` in each action (auto-generated by build)

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: All workspaces pass — `packages/lib`, `check-release-version`, `extract-dotnet-version`, `generate-release-notes`, `render-template`.

- [ ] **Step 2: Run type-check**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Run the build**

```bash
npm run build
```

Expected: Each action's `dist/index.js` is updated with the new bundled code. No errors.

- [ ] **Step 4: Commit the updated dist files**

```bash
git add check-release-version/dist/index.js extract-dotnet-version/dist/index.js generate-release-notes/dist/index.js render-template/dist/index.js
git commit -m "build: rebuild dist after runAction refactor"
```
