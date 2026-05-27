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
      error instanceof Error
        ? `Template syntax error: ${error.message}`
        : 'Template rendering failed due to a syntax error',
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
