import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'generate-release-notes',
    globals: true,
    clearMocks: false,
  },
});
