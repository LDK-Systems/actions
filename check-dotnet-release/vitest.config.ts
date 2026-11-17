import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'check-dotnet-release',
    globals: true,
    coverage: {
      provider: 'v8',
      thresholds: { lines: 80 },
    },
  },
});
