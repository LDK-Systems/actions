// Feature: github-actions-monorepo, Property 1: Version extraction applies correct precedence rules
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 *
 * Property 1: Version extraction applies correct precedence rules
 *
 * For any valid .csproj XML content containing any combination of <Version>,
 * <VersionPrefix>, and <VersionSuffix> elements with arbitrary non-empty string
 * values, the version extraction logic SHALL produce outputs that satisfy:
 * (a) if <Version> is present, the version output equals its value regardless of other elements
 * (b) if only <VersionPrefix> and <VersionSuffix> are present, the version output equals "{prefix}-{suffix}"
 * (c) if only <VersionPrefix> is present, the version output equals the prefix value
 */

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

// Mock @actions/core
vi.mock('@actions/core', () => ({
  getInput: vi.fn(),
  setOutput: vi.fn(),
  setFailed: vi.fn(),
}));

describe('Property 1: Version extraction applies correct precedence rules', () => {
  type CoreMock = {
    getInput: ReturnType<typeof vi.fn>;
    setOutput: ReturnType<typeof vi.fn>;
    setFailed: ReturnType<typeof vi.fn>;
  };
  type FsMock = { existsSync: ReturnType<typeof vi.fn>; readFileSync: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  /** Arbitrary for version-like strings: alphanumeric with dots and hyphens, no XML-special chars */
  const versionStringArb = fc.stringOf(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.'.split('')),
    { minLength: 1, maxLength: 20 },
  );

  /** Build a .csproj XML string with optional Version, VersionPrefix, VersionSuffix elements */
  function buildCsproj(opts: {
    version?: string;
    versionPrefix?: string;
    versionSuffix?: string;
  }): string {
    let propertyGroup = '';
    if (opts.version !== undefined) {
      propertyGroup += `    <Version>${opts.version}</Version>\n`;
    }
    if (opts.versionPrefix !== undefined) {
      propertyGroup += `    <VersionPrefix>${opts.versionPrefix}</VersionPrefix>\n`;
    }
    if (opts.versionSuffix !== undefined) {
      propertyGroup += `    <VersionSuffix>${opts.versionSuffix}</VersionSuffix>\n`;
    }
    return `<Project Sdk="Microsoft.NET.Sdk">\n  <PropertyGroup>\n${propertyGroup}  </PropertyGroup>\n</Project>`;
  }

  /**
   * Arbitrary that generates one of the valid combinations:
   * - All three present (Version, Prefix, Suffix)
   * - Only Version
   * - Only Prefix + Suffix
   * - Only Prefix
   * - Version + Prefix (Version takes precedence)
   * - Version + Suffix (Version takes precedence)
   */
  const versionCombinationArb = fc.oneof(
    // All three present
    fc
      .record({
        version: versionStringArb,
        versionPrefix: versionStringArb,
        versionSuffix: versionStringArb,
      })
      .map((r) => ({ ...r, expectedVersion: r.version, label: 'all-three' as const })),
    // Only Version
    fc
      .record({
        version: versionStringArb,
      })
      .map((r) => ({
        ...r,
        versionPrefix: undefined,
        versionSuffix: undefined,
        expectedVersion: r.version,
        label: 'version-only' as const,
      })),
    // Only Prefix + Suffix
    fc
      .record({
        versionPrefix: versionStringArb,
        versionSuffix: versionStringArb,
      })
      .map((r) => ({
        ...r,
        version: undefined,
        expectedVersion: `${r.versionPrefix}-${r.versionSuffix}`,
        label: 'prefix-suffix' as const,
      })),
    // Only Prefix
    fc
      .record({
        versionPrefix: versionStringArb,
      })
      .map((r) => ({
        ...r,
        version: undefined,
        versionSuffix: undefined,
        expectedVersion: r.versionPrefix,
        label: 'prefix-only' as const,
      })),
    // Version + Prefix (Version takes precedence)
    fc
      .record({
        version: versionStringArb,
        versionPrefix: versionStringArb,
      })
      .map((r) => ({
        ...r,
        versionSuffix: undefined,
        expectedVersion: r.version,
        label: 'version-prefix' as const,
      })),
    // Version + Suffix (Version takes precedence)
    fc
      .record({
        version: versionStringArb,
        versionSuffix: versionStringArb,
      })
      .map((r) => ({
        ...r,
        versionPrefix: undefined,
        expectedVersion: r.version,
        label: 'version-suffix' as const,
      })),
  );

  it('version extraction applies correct precedence rules for all combinations', async () => {
    await fc.assert(
      fc.asyncProperty(versionCombinationArb, async (combo) => {
        // Reset mocks for each iteration
        vi.resetModules();
        vi.resetAllMocks();

        const coreMod = (await import('@actions/core')) as unknown as CoreMock;
        const fsMod = (await import('fs')) as unknown as FsMock;

        const csprojContent = buildCsproj({
          version: combo.version,
          versionPrefix: combo.versionPrefix,
          versionSuffix: combo.versionSuffix,
        });

        // Setup mocks
        coreMod.getInput.mockReturnValue('test.csproj');
        fsMod.existsSync.mockReturnValue(true);
        fsMod.readFileSync.mockReturnValue(csprojContent);

        // Dynamically import the action to trigger run()
        await import('../src/index');

        // Verify setFailed was NOT called
        expect(coreMod.setFailed).not.toHaveBeenCalled();

        // Verify the version output matches expected precedence
        const setOutputCalls = coreMod.setOutput.mock.calls;
        const versionCall = setOutputCalls.find((call: unknown[]) => call[0] === 'version');

        expect(versionCall).toBeDefined();
        expect(versionCall![1]).toBe(combo.expectedVersion);
      }),
      { numRuns: 100 },
    );
  }, 30000);
});
