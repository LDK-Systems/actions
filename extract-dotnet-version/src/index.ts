import * as core from '@actions/core';
import { parseXmlElement } from '@ldk-systems/lib';
import { readFileSync, existsSync } from 'fs';

/**
 * Main entry point for the extract-dotnet-version action.
 */
async function run(): Promise<void> {
  try {
    const projectFile = core.getInput('project-file', { required: true });

    // 1. Check file existence (precedence over parse errors — Req 2.5)
    if (!existsSync(projectFile)) {
      core.setFailed(`File not found: ${projectFile}`);
      return;
    }

    // 2. Read the .csproj file
    const content = readFileSync(projectFile, 'utf-8');

    // 3. Extract Version, VersionPrefix, VersionSuffix elements
    let version: string | undefined;
    let versionPrefix: string | undefined;
    let versionSuffix: string | undefined;

    try {
      version = parseXmlElement(content, 'Version');
      versionPrefix = parseXmlElement(content, 'VersionPrefix');
      versionSuffix = parseXmlElement(content, 'VersionSuffix');
    } catch {
      // File is not valid XML (Req 2.7)
      core.setFailed(`File is not valid XML: ${projectFile}`);
      return;
    }

    // 4. Fail if none found (Req 2.6)
    if (version === undefined && versionPrefix === undefined && versionSuffix === undefined) {
      core.setFailed(`No version information found in ${projectFile}`);
      return;
    }

    // 5. Apply precedence: Version > VersionPrefix-VersionSuffix > VersionPrefix (Req 2.2-2.4)
    let resolvedVersion: string;

    if (version !== undefined) {
      // Version element takes precedence over everything
      resolvedVersion = version;
    } else if (versionPrefix !== undefined && versionSuffix !== undefined) {
      // Construct version from prefix and suffix
      resolvedVersion = `${versionPrefix}-${versionSuffix}`;
    } else if (versionPrefix !== undefined) {
      // Use prefix alone as version
      resolvedVersion = versionPrefix;
    } else {
      // Only VersionSuffix present without prefix — still set outputs
      resolvedVersion = '';
    }

    // 6. Set outputs: version, version-prefix, version-suffix
    core.setOutput('version', resolvedVersion);
    core.setOutput('version-prefix', versionPrefix ?? '');
    core.setOutput('version-suffix', versionSuffix ?? '');
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

run();
