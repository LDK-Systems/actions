import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@actions/core');
vi.mock('@ldk-systems/lib', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ldk-systems/lib')>();
  const { setFailed } = await import('@actions/core');
  return {
    ...actual,
    renderTemplate: vi.fn(),
    createRelease: vi.fn(),
    runAction: (fn: () => Promise<void>) => {
      fn().catch((error: unknown) => {
        setFailed(error instanceof Error ? error.message : 'An unexpected error occurred');
      });
    },
  };
});
vi.mock('fs');

import * as core from '@actions/core';
import { renderTemplate, createRelease } from '@ldk-systems/lib';
import { existsSync, readFileSync } from 'fs';

const mockedCore = vi.mocked(core);
const mockedRenderTemplate = vi.mocked(renderTemplate);
const mockedCreateRelease = vi.mocked(createRelease);
const mockedExistsSync = vi.mocked(existsSync);
const mockedReadFileSync = vi.mocked(readFileSync);

function setupInputs(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    template: '# Release {{version}}\n\n{{notes}}',
    'template-file': '',
    'template-vars': JSON.stringify({ version: '1.0.0', notes: 'Initial release' }),
    version: '1.0.0',
    repository: 'owner/repo',
    token: 'gh-token',
  };

  const inputs = { ...defaults, ...overrides };
  mockedCore.getInput.mockImplementation((name: string) => inputs[name] ?? '');
}

describe('generate-release-notes', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };

    mockedRenderTemplate.mockReturnValue('# Release 1.0.0\n\nInitial release');
    mockedCreateRelease.mockResolvedValue({
      id: 123,
      url: 'https://api.github.com/repos/owner/repo/releases/123',
      htmlUrl: 'https://github.com/owner/repo/releases/tag/1.0.0',
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('renders template and creates release with correct parameters', async () => {
    setupInputs();

    await import('../src/index');

    expect(mockedRenderTemplate).toHaveBeenCalledWith('# Release {{version}}\n\n{{notes}}', {
      version: '1.0.0',
      notes: 'Initial release',
    });
    expect(mockedCreateRelease).toHaveBeenCalledWith({
      token: 'gh-token',
      owner: 'owner',
      repo: 'repo',
      tag: '1.0.0',
      name: '1.0.0',
      body: '# Release 1.0.0\n\nInitial release',
      draft: false,
      prerelease: false,
    });
    expect(mockedCore.setFailed).not.toHaveBeenCalled();
  });

  it('outputs release-url from API response', async () => {
    setupInputs();

    await import('../src/index');

    expect(mockedCore.setOutput).toHaveBeenCalledWith(
      'release-url',
      'https://github.com/owner/repo/releases/tag/1.0.0',
    );
  });

  it('outputs release-notes containing rendered body', async () => {
    setupInputs();
    mockedRenderTemplate.mockReturnValue('Rendered release body content');

    await import('../src/index');

    expect(mockedCore.setOutput).toHaveBeenCalledWith(
      'release-notes',
      'Rendered release body content',
    );
  });

  it('uses inline template input when provided (precedence over template-file)', async () => {
    setupInputs({
      template: '## Inline {{version}}',
      'template-file': '/some/path/template.hbs',
    });

    await import('../src/index');

    // Should use inline template, NOT read from file
    expect(mockedReadFileSync).not.toHaveBeenCalled();
    expect(mockedRenderTemplate).toHaveBeenCalledWith('## Inline {{version}}', expect.any(Object));
    expect(mockedCore.setFailed).not.toHaveBeenCalled();
  });

  it('reads template from template-file path when no inline template', async () => {
    setupInputs({
      template: '',
      'template-file': '/path/to/custom-template.hbs',
    });
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue('# File Template {{version}}' as never);

    await import('../src/index');

    expect(mockedExistsSync).toHaveBeenCalled();
    expect(mockedReadFileSync).toHaveBeenCalledWith(
      expect.stringContaining('custom-template.hbs'),
      'utf-8',
    );
    expect(mockedRenderTemplate).toHaveBeenCalledWith(
      '# File Template {{version}}',
      expect.any(Object),
    );
    expect(mockedCore.setFailed).not.toHaveBeenCalled();
  });

  it('uses default bundled template when neither template nor template-file provided', async () => {
    setupInputs({
      template: '',
      'template-file': '',
    });
    mockedReadFileSync.mockReturnValue('# Default {{version}}' as never);

    await import('../src/index');

    // Should read from the default template path (join(__dirname, '..', 'default-template.hbs'))
    expect(mockedReadFileSync).toHaveBeenCalledWith(
      expect.stringContaining('default-template.hbs'),
      'utf-8',
    );
    expect(mockedRenderTemplate).toHaveBeenCalledWith('# Default {{version}}', expect.any(Object));
    expect(mockedCore.setFailed).not.toHaveBeenCalled();
  });

  it('fails when template-file path does not exist', async () => {
    setupInputs({
      template: '',
      'template-file': '/nonexistent/template.hbs',
    });
    mockedExistsSync.mockReturnValue(false);

    await import('../src/index');

    expect(mockedCore.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('Template file not found'),
    );
    expect(mockedCreateRelease).not.toHaveBeenCalled();
  });

  it('collects RELEASE_VAR_ environment variables as template variables', async () => {
    process.env.RELEASE_VAR_APP_NAME = 'MyApp';
    process.env.RELEASE_VAR_AUTHOR = 'TeamX';

    setupInputs({
      template: '{{app_name}} by {{author}}',
      'template-vars': '{}',
    });

    await import('../src/index');

    expect(mockedRenderTemplate).toHaveBeenCalledWith(
      '{{app_name}} by {{author}}',
      expect.objectContaining({
        app_name: 'MyApp',
        author: 'TeamX',
      }),
    );
    expect(mockedCore.setFailed).not.toHaveBeenCalled();
  });

  it('template-vars input takes precedence over RELEASE_VAR_ env vars for same key', async () => {
    process.env.RELEASE_VAR_VERSION = 'env-version';
    process.env.RELEASE_VAR_AUTHOR = 'env-author';

    setupInputs({
      template: '{{version}} {{author}}',
      'template-vars': JSON.stringify({ version: 'input-version' }),
    });

    await import('../src/index');

    expect(mockedRenderTemplate).toHaveBeenCalledWith(
      '{{version}} {{author}}',
      expect.objectContaining({
        version: 'input-version',
        author: 'env-author',
      }),
    );
  });

  it('fails on Handlebars template syntax errors', async () => {
    setupInputs();
    mockedRenderTemplate.mockImplementation(() => {
      throw new Error('Parse error on line 1');
    });

    await import('../src/index');

    expect(mockedCore.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('Template syntax error'),
    );
    expect(mockedCreateRelease).not.toHaveBeenCalled();
  });

  it('fails on empty version', async () => {
    setupInputs({ version: '' });

    await import('../src/index');

    expect(mockedCore.setFailed).toHaveBeenCalledWith('Input "version" must not be empty');
  });

  it('fails on invalid repository format', async () => {
    setupInputs({ repository: 'invalid-repo' });

    await import('../src/index');

    expect(mockedCore.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('must be in owner/repo format'),
    );
  });

  it('fails on invalid JSON in template-vars', async () => {
    setupInputs({ 'template-vars': 'not json{' });

    await import('../src/index');

    expect(mockedCore.setFailed).toHaveBeenCalledWith('Input "template-vars" is not valid JSON');
  });

  it('fails on non-object JSON (array)', async () => {
    setupInputs({ 'template-vars': '["a","b"]' });

    await import('../src/index');

    expect(mockedCore.setFailed).toHaveBeenCalledWith(
      'Input "template-vars" must be a JSON object',
    );
  });

  it('fails on non-object JSON (null)', async () => {
    setupInputs({ 'template-vars': 'null' });

    await import('../src/index');

    expect(mockedCore.setFailed).toHaveBeenCalledWith(
      'Input "template-vars" must be a JSON object',
    );
  });

  it('fails on GitHub API error', async () => {
    setupInputs();
    mockedCreateRelease.mockRejectedValue(new Error('Bad credentials'));

    await import('../src/index');
    await Promise.resolve();
    await Promise.resolve();

    expect(mockedCore.setFailed).toHaveBeenCalledWith('Bad credentials');
  });

  it('leaves unmatched placeholders unchanged', async () => {
    setupInputs({
      template: '# {{version}} - {{unknown}}',
      'template-vars': JSON.stringify({ version: '2.0.0' }),
    });
    mockedRenderTemplate.mockReturnValue('# 2.0.0 - {{unknown}}');

    await import('../src/index');

    expect(mockedRenderTemplate).toHaveBeenCalledWith('# {{version}} - {{unknown}}', {
      version: '2.0.0',
    });
    expect(mockedCore.setFailed).not.toHaveBeenCalled();
  });
});
