import * as core from '@actions/core';
import { renderTemplate } from '@ldk-systems/lib';
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
  try {
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
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : 'An unexpected error occurred');
  }
}

run();
