import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'check-release-version',
    globals: true,
    clearMocks: false,
  },
});
