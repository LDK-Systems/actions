import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@actions/core');
vi.mock('@ldk-systems/lib', () => ({
  renderTemplate: vi.fn(),
}));
vi.mock('fs');

import * as core from '@actions/core';
import { renderTemplate } from '@ldk-systems/lib';
import { existsSync, readFileSync } from 'fs';

const mockedCore = vi.mocked(core);
const mockedRenderTemplate = vi.mocked(renderTemplate);
const mockedExistsSync = vi.mocked(existsSync);
const mockedReadFileSync = vi.mocked(readFileSync);

function setupInputs(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    template: 'Hello, {{name}}!',
    'template-file': '',
    'template-vars': JSON.stringify({ name: 'World' }),
  };
  const inputs = { ...defaults, ...overrides };
  mockedCore.getInput.mockImplementation((name: string) => inputs[name] ?? '');
}

describe('render-template', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    mockedRenderTemplate.mockReturnValue('Hello, World!');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('template resolution', () => {
    it('renders inline template and sets result output', async () => {
      setupInputs();

      await import('../src/index');

      expect(mockedRenderTemplate).toHaveBeenCalledWith('Hello, {{name}}!', { name: 'World' });
      expect(mockedCore.setOutput).toHaveBeenCalledWith('result', 'Hello, World!');
      expect(mockedCore.setFailed).not.toHaveBeenCalled();
    });

    it('uses inline template over template-file when both are provided', async () => {
      setupInputs({
        template: 'Inline {{name}}',
        'template-file': '/some/template.hbs',
      });

      await import('../src/index');

      expect(mockedReadFileSync).not.toHaveBeenCalled();
      expect(mockedRenderTemplate).toHaveBeenCalledWith('Inline {{name}}', expect.any(Object));
      expect(mockedCore.setFailed).not.toHaveBeenCalled();
    });

    it('reads template from template-file when no inline template', async () => {
      setupInputs({ template: '', 'template-file': '/path/to/template.hbs' });
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue('File {{name}}' as never);

      await import('../src/index');

      expect(mockedReadFileSync).toHaveBeenCalledWith(
        expect.stringContaining('template.hbs'),
        'utf-8',
      );
      expect(mockedRenderTemplate).toHaveBeenCalledWith('File {{name}}', expect.any(Object));
      expect(mockedCore.setFailed).not.toHaveBeenCalled();
    });

    it('fails when neither template nor template-file is provided', async () => {
      setupInputs({ template: '', 'template-file': '' });

      await import('../src/index');

      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('"template" or "template-file"'),
      );
      expect(mockedCore.setOutput).not.toHaveBeenCalled();
    });

    it('fails when template-file path does not exist', async () => {
      setupInputs({ template: '', 'template-file': '/nonexistent/template.hbs' });
      mockedExistsSync.mockReturnValue(false);

      await import('../src/index');

      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('Template file not found'),
      );
      expect(mockedCore.setOutput).not.toHaveBeenCalled();
    });
  });

  describe('template-vars parsing', () => {
    it('passes parsed vars object to renderTemplate', async () => {
      setupInputs({ 'template-vars': JSON.stringify({ key: 'value', count: 3 }) });

      await import('../src/index');

      expect(mockedRenderTemplate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ key: 'value', count: 3 }),
      );
    });

    it('passes array values through to renderTemplate for list iteration', async () => {
      setupInputs({
        template: '{{#each items}}{{this}} {{/each}}',
        'template-vars': JSON.stringify({ items: ['a', 'b', 'c'] }),
      });
      mockedRenderTemplate.mockReturnValue('a b c ');

      await import('../src/index');

      expect(mockedRenderTemplate).toHaveBeenCalledWith(
        '{{#each items}}{{this}} {{/each}}',
        expect.objectContaining({ items: ['a', 'b', 'c'] }),
      );
      expect(mockedCore.setOutput).toHaveBeenCalledWith('result', 'a b c ');
    });

    it('passes nested object values through to renderTemplate', async () => {
      setupInputs({
        template: '{{person.name}}',
        'template-vars': JSON.stringify({ person: { name: 'Alice' } }),
      });
      mockedRenderTemplate.mockReturnValue('Alice');

      await import('../src/index');

      expect(mockedRenderTemplate).toHaveBeenCalledWith(
        '{{person.name}}',
        expect.objectContaining({ person: { name: 'Alice' } }),
      );
    });

    it('uses empty object when template-vars is not provided', async () => {
      setupInputs({ 'template-vars': '' });

      await import('../src/index');

      expect(mockedRenderTemplate).toHaveBeenCalledWith(expect.any(String), {});
    });

    it('fails on invalid JSON in template-vars', async () => {
      setupInputs({ 'template-vars': 'not json{' });

      await import('../src/index');

      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        'Input "template-vars" is not valid JSON',
      );
      expect(mockedCore.setOutput).not.toHaveBeenCalled();
    });

    it('fails when template-vars is a JSON array', async () => {
      setupInputs({ 'template-vars': '["a","b"]' });

      await import('../src/index');

      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        'Input "template-vars" must be a JSON object',
      );
    });

    it('fails when template-vars is JSON null', async () => {
      setupInputs({ 'template-vars': 'null' });

      await import('../src/index');

      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        'Input "template-vars" must be a JSON object',
      );
    });
  });

  describe('rendering errors', () => {
    it('fails on Handlebars template syntax error', async () => {
      setupInputs();
      mockedRenderTemplate.mockImplementation(() => {
        throw new Error('Parse error on line 1');
      });

      await import('../src/index');

      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('Template syntax error'),
      );
      expect(mockedCore.setOutput).not.toHaveBeenCalled();
    });

    it('leaves unmatched placeholders unchanged in output', async () => {
      setupInputs({
        template: '{{matched}} and {{unmatched}}',
        'template-vars': JSON.stringify({ matched: 'found' }),
      });
      mockedRenderTemplate.mockReturnValue('found and {{unmatched}}');

      await import('../src/index');

      expect(mockedCore.setOutput).toHaveBeenCalledWith('result', 'found and {{unmatched}}');
      expect(mockedCore.setFailed).not.toHaveBeenCalled();
    });
  });

  describe('comparison helpers integration', () => {
    it('renders conditional output based on eq helper', async () => {
      setupInputs({
        template: '{{#if (eq status "active")}}on{{else}}off{{/if}}',
        'template-vars': JSON.stringify({ status: 'active' }),
      });
      mockedRenderTemplate.mockReturnValue('on');

      await import('../src/index');

      expect(mockedCore.setOutput).toHaveBeenCalledWith('result', 'on');
    });

    it('renders conditional output based on gt helper', async () => {
      setupInputs({
        template: '{{#if (gt count 3)}}many{{else}}few{{/if}}',
        'template-vars': JSON.stringify({ count: 5 }),
      });
      mockedRenderTemplate.mockReturnValue('many');

      await import('../src/index');

      expect(mockedCore.setOutput).toHaveBeenCalledWith('result', 'many');
    });
  });
});
