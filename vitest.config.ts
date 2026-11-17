import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    clearMocks: false,
    projects: [
      'packages/lib/vitest.config.ts',
      'extract-dotnet-version/vitest.config.ts',
      'check-release-version/vitest.config.ts',
      'check-dotnet-release/vitest.config.ts',
      'generate-release-notes/vitest.config.ts',
      'render-template/vitest.config.ts',
    ],
    coverage: {
      provider: 'v8',
      include: ['*/src/**/*.ts', 'packages/*/src/**/*.ts'],
      thresholds: { lines: 80 },
    },
  },
});
