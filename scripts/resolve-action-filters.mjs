import process from 'node:process';
import { createActionFilters, getActionWorkspaces } from './action-workspaces.mjs';

// JSON is a valid YAML document. dorny/paths-filter reads this as its filter file.
process.stdout.write(JSON.stringify(createActionFilters(getActionWorkspaces()), null, 2) + '\n');
