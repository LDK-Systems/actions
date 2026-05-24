import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/lib',
  'extract-dotnet-version',
  'check-release-version',
  'generate-release-notes',
]);
