import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'extract-dotnet-version',
    globals: true,
    clearMocks: false,
  },
});
