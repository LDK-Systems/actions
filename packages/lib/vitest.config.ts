import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'lib',
    globals: true,
    clearMocks: false,
  },
});
