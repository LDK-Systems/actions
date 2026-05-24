import { describe, it, expect } from 'vitest';
import { renderTemplate } from '../src/template';

describe('renderTemplate', () => {
  describe('{{variable}} placeholders', () => {
    it('replaces a single placeholder with the corresponding value', () => {
      const result = renderTemplate('Hello, {{name}}!', { name: 'World' });
      expect(result).toBe('Hello, World!');
    });

    it('replaces multiple different placeholders in one template', () => {
      const result = renderTemplate(
        '{{greeting}}, {{name}}! Version {{version}}.',
        { greeting: 'Hi', name: 'Alice', version: '1.0.0' }
      );
      expect(result).toBe('Hi, Alice! Version 1.0.0.');
    });

    it('replaces repeated occurrences of the same placeholder', () => {
      const result = renderTemplate('{{x}} and {{x}}', { x: 'val' });
      expect(result).toBe('val and val');
    });
  });

  describe('{{#if}} conditionals', () => {
    it('renders the if-block content when the variable is truthy', () => {
      const template = '{{#if showGreeting}}Hello!{{/if}}';
      const result = renderTemplate(template, { showGreeting: 'yes' });
      expect(result).toBe('Hello!');
    });

    it('does not render the if-block content when the variable is falsy', () => {
      const template = '{{#if showGreeting}}Hello!{{/if}}';
      const result = renderTemplate(template, { showGreeting: '' });
      expect(result).toBe('');
    });

    it('renders the else-block when the variable is falsy', () => {
      const template = '{{#if active}}Active{{else}}Inactive{{/if}}';
      const result = renderTemplate(template, { active: '' });
      expect(result).toBe('Inactive');
    });
  });

  describe('{{#each}} iteration', () => {
    it('iterates over an array of items', () => {
      const template = '{{#each items}}{{this}} {{/each}}';
      const result = renderTemplate(template, {
        items: ['a', 'b', 'c'] as unknown as string,
      });
      expect(result).toBe('a b c ');
    });

    it('renders nothing for an empty array', () => {
      const template = '{{#each items}}item{{/each}}';
      const result = renderTemplate(template, {
        items: [] as unknown as string,
      });
      expect(result).toBe('');
    });
  });

  describe('unmatched variables', () => {
    it('leaves unmatched placeholders unchanged when key not in variables', () => {
      const result = renderTemplate('{{matched}} and {{unmatched}}', {
        matched: 'found',
      });
      expect(result).toBe('found and {{unmatched}}');
    });

    it('returns template unchanged when variables object is empty', () => {
      const template = 'No {{replacements}} here';
      const result = renderTemplate(template, {});
      expect(result).toBe('No {{replacements}} here');
    });
  });

  describe('empty template and empty variables', () => {
    it('returns empty string for empty template input', () => {
      const result = renderTemplate('', { key: 'value' });
      expect(result).toBe('');
    });

    it('returns empty string for empty template and empty variables', () => {
      const result = renderTemplate('', {});
      expect(result).toBe('');
    });
  });

  describe('comparison helpers', () => {
    it('eq returns true when values are strictly equal', () => {
      const result = renderTemplate('{{#if (eq status "active")}}yes{{else}}no{{/if}}', {
        status: 'active',
      });
      expect(result).toBe('yes');
    });

    it('eq returns false when values differ', () => {
      const result = renderTemplate('{{#if (eq status "active")}}yes{{else}}no{{/if}}', {
        status: 'inactive',
      });
      expect(result).toBe('no');
    });

    it('ne returns true when values differ', () => {
      const result = renderTemplate('{{#if (ne status "active")}}different{{/if}}', {
        status: 'inactive',
      });
      expect(result).toBe('different');
    });

    it('gt returns true when left is greater', () => {
      const result = renderTemplate('{{#if (gt count 3)}}big{{else}}small{{/if}}', { count: 5 });
      expect(result).toBe('big');
    });

    it('gte returns true when left equals right', () => {
      const result = renderTemplate('{{#if (gte count 5)}}yes{{/if}}', { count: 5 });
      expect(result).toBe('yes');
    });

    it('lt returns true when left is less', () => {
      const result = renderTemplate('{{#if (lt count 10)}}small{{/if}}', { count: 3 });
      expect(result).toBe('small');
    });

    it('lte returns true when left equals right', () => {
      const result = renderTemplate('{{#if (lte count 5)}}yes{{/if}}', { count: 5 });
      expect(result).toBe('yes');
    });
  });

  describe('invalid Handlebars syntax', () => {
    it('throws on unclosed block helper', () => {
      expect(() => renderTemplate('{{#if open}}no close', {})).toThrow();
    });

    it('throws on mismatched block helper close tag', () => {
      expect(() =>
        renderTemplate('{{#if x}}content{{/each}}', { x: 'yes' })
      ).toThrow();
    });
  });
});
