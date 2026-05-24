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
