import * as core from '@actions/core';
import { renderTemplate, createRelease } from '@ldk-systems/lib';
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
  // 1. Inline template takes precedence
  if (templateInput) {
    return templateInput;
  }

  // 2. Template file path
  if (templateFileInput) {
    const resolvedPath = resolve(templateFileInput);
    if (!existsSync(resolvedPath)) {
      throw new Error(`Template file not found: ${templateFileInput}`);
    }
    return readFileSync(resolvedPath, 'utf-8');
  }

  // 3. Default bundled template
  const defaultTemplatePath = join(__dirname, '..', 'default-template.hbs');
  return readFileSync(defaultTemplatePath, 'utf-8');
}

/**
 * Main entry point for the generate-release-notes action.
 */
async function run(): Promise<void> {
  try {
    const templateInput = core.getInput('template');
    const templateFileInput = core.getInput('template-file');
    const templateVarsRaw = core.getInput('template-vars') || '{}';
    const version = core.getInput('version', { required: true });
    const repository = core.getInput('repository', { required: true });
    const token = core.getInput('token') || process.env.GITHUB_TOKEN || '';

    // 1. Validate inputs — fail immediately on first invalid input (Req 12.6)
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

    // 2. Parse template-vars JSON — fail if not valid JSON object (Req 12.5)
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

    // 3. Resolve template source (Req 12.1, 12.2, 12.3)
    let template: string;
    try {
      template = resolveTemplate(templateInput, templateFileInput);
    } catch (error) {
      if (error instanceof Error) {
        core.setFailed(error.message);
      } else {
        core.setFailed('Failed to resolve template');
      }
      return;
    }

    // 4. Collect RELEASE_VAR_ environment variables (Req 12.6)
    const envVars = collectReleaseVarEnv();

    // 5. Merge variables: template-vars input takes precedence over RELEASE_VAR_ env vars (Req 12.7)
    const templateVars: Record<string, string> = { ...envVars, ...inputVars };

    // 6. Render template with variables via shared lib (Req 12.9, 12.14)
    let body: string;
    try {
      body = renderTemplate(template, templateVars);
    } catch (error) {
      if (error instanceof Error) {
        core.setFailed(`Template syntax error: ${error.message}`);
      } else {
        core.setFailed('Template rendering failed due to a syntax error');
      }
      return;
    }

    // 7. Create release via shared lib (Req 13.2)
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

    // 8. Set outputs (Req 12.10)
    core.setOutput('release-url', result.htmlUrl);
    core.setOutput('release-notes', body);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

run();
