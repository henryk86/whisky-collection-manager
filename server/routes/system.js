import fs from 'node:fs';

const version = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;

/**
 * Public application version and health-check contract.
 * @type {import('./contract.js').ApiRoute[]}
 */
export const systemRoutes = [
  {
    method: 'GET', path: /^\/api\/version$/,
    /**
     * Reports the running package version.
     * @return {{version: string}} Installed application version.
     */
    run: () => ({version}),
  },
];
