import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyDeploymentConfiguration} from '../../scripts/check-deployment-config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta
  .url)), '../..');
const load = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

/** Verify that dangerous configuration mutations fail the checker. The checker
 * itself runs from `npm run check` in every PR; no source-line regex assertion
 * is made about the application implementation. */
test(
  'configuration validation accepts the deployed HTTPS, CI and offline contract',
  () => {
    assert.deepEqual(verifyDeploymentConfiguration(load), {
      service: 'app', statusJob: 'test', browserCheck: true, offlineCheck: true,
    });
  }
);

for (const [description, file, search, replacement] of [
  [
    'rejects publishing plaintext HTTP',
    'docker-compose.yml',
    "HTTP_ENABLED: 'false'",
    "HTTP_ENABLED: 'true'",
  ],
  [
    'rejects missing persistent data volume',
    'docker-compose.yml',
    ':/srv/whisky',
    ':/tmp/whisky',
  ],
  [
    'rejects an extra backup container',
    'docker-compose.yml',
    '  app:\n',
    '  app:\n  backup-worker:\n',
  ],
  [
    'rejects a missing browser suite in PR checks',
    '.github/workflows/check.yml',
    'npm run test:browser',
    'npm run test:skipped',
  ],
  [
    'rejects missing offline isolation in release',
    '.github/workflows/release.yml',
    '--network none',
    '--network host',
  ],
  [
    'rejects unscoped GitHub upload commands',
    '.github/workflows/release.yml',
    'run: gh release upload "$TAG" dist/*.zip dist/*.sha256 --clobber --repo "$GITHUB_REPOSITORY"',
    'run: gh release upload "$TAG" dist/*.zip dist/*.sha256 --clobber',
  ],
  [
    'rejects removing protected-main release PR preparation',
    'scripts/sync-release-branches.js',
    'export function prepareSyncPR',
    'export function disabledSyncPR',
  ],
  [
    'rejects removing develop sync after GitHub merge',
    '.github/workflows/release.yml',
    'sync-release-branches.js finish --tag',
    'sync-release-branches.js skip --tag',
  ],
  [
    'rejects Dependabot targeting main',
    '.github/dependabot.yml',
    'target-branch: "develop"',
    'target-branch: "main"',
  ],
  [
    'rejects missing merged-PR API release gate',
    '.github/workflows/release.yml',
    'node scripts/verify-merged-pr.js',
    'node scripts/skip-merged-pr-verification.js',
  ],
  [
    'rejects missing permission to inspect private PRs',
    '.github/workflows/release.yml',
    'pull-requests: read',
    'pull-requests: none',
  ],
  [
    'rejects production builds that omit AI asset preparation',
    'docker/app.Dockerfile',
    'node scripts/prepare-cutout-assets.js',
    'node scripts/no-cutout-assets.js',
  ],
]) {
  test(`configuration validation ${description}`, () => {
    const original = load(file);
    assert.ok(
      original.includes(search),
      `test fixture prerequisite: ${description}`
    );
    assert.throws(
      () => verifyDeploymentConfiguration(name => name === file ?
        original.replace(search, replacement) : load(name)),
      /Deployment contract:/
    );
  });
}
