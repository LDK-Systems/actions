import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'check-dotnet-release',
    globals: true,
    clearMocks: false,
  },
});
