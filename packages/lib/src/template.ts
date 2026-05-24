import Handlebars from 'handlebars';

/**
 * Compiles and renders a Handlebars template with the provided variables.
 * Supports full Handlebars syntax: {{variable}} interpolation, {{#if}} conditionals,
 * {{#each}} iteration, and other Handlebars helpers.
 *
 * Comparison helpers are available as subexpressions for use in conditionals:
 * eq, ne, gt, gte, lt, lte (e.g. {{#if (eq status "active")}}...{{/if}}).
 *
 * Unmatched simple variable placeholders ({{key}}) remain unchanged in the output
 * for backward compatibility. This is achieved by using a custom helper that
 * preserves the original placeholder text when a variable is not found.
 *
 * @param template - Handlebars template string
 * @param variables - Variables for template substitution; values may be strings, arrays, or objects
 * @returns The rendered string with variables replaced
 * @throws Error if the template contains invalid Handlebars syntax
 */
export function renderTemplate(template: string, variables: Record<string, unknown>): string {
  const instance = Handlebars.create();

  instance.registerHelper('eq', (a: unknown, b: unknown) => a === b);
  instance.registerHelper('ne', (a: unknown, b: unknown) => a !== b);
  instance.registerHelper('gt', (a: unknown, b: unknown) => (a as number) > (b as number));
  instance.registerHelper('gte', (a: unknown, b: unknown) => (a as number) >= (b as number));
  instance.registerHelper('lt', (a: unknown, b: unknown) => (a as number) < (b as number));
  instance.registerHelper('lte', (a: unknown, b: unknown) => (a as number) <= (b as number));

  // Register a custom helperMissing that preserves unmatched simple placeholders
  instance.registerHelper('helperMissing', function (this: unknown, ...args: unknown[]) {
    const options = args[args.length - 1] as Handlebars.HelperOptions & { name?: string };
    // Only preserve simple variable lookups (no arguments beyond options)
    if (args.length === 1 && options.name) {
      return new instance.SafeString(`{{${options.name}}}`);
    }
    // For block helpers or helpers with arguments, throw the default error
    const name = options.name || 'unknown';
    throw new Error(`Missing helper: "${name}"`);
  });

  const compiled = instance.compile(template, { noEscape: true });
  return compiled(variables);
}
