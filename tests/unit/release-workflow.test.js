import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {
  compareVersions, nextVersion, parseVersion, updateReadmeTitle,
  pendingTestStatus, verifyReleaseMetadata
}
  from '../../scripts/release-version.js';
import {prohibitedReleasePath} from '../../scripts/verify-release-files.js';
import {readSourceManifest} from '../../scripts/release-manifest.js';
/**
 * Reads read data from the local filesystem.
 *
 * @param {*} file File resource to read, write or inspect.
 * @return {*} Result computed from the supplied inputs.
 */
const read = file => fs.readFileSync(file, 'utf8');

test(
  'release version parser and automatic bump support patch/minor/major',
  () => {
    assert.deepEqual(parseVersion('0.6.32'), [0, 6, 32]);
    assert.equal(nextVersion('0.6.32', 'patch'), '0.6.33');
    assert.equal(nextVersion('0.6.32', 'minor'), '0.7.0');
    assert.equal(nextVersion('0.6.32', 'major'), '1.0.0');
    assert.equal(compareVersions('0.6.32', '0.6.31'), 1);
    assert.equal(compareVersions('0.7.0', '0.6.99'), 1);
    assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
    assert.throws(() => parseVersion('v0.6.32'), /Ungueltige/);
    assert.throws(() => nextVersion('1.2.3', 'none'), /Verwendung/);
  }
);

test(
  'develop keeps version metadata aligned without rewriting the immutable \
released source manifest',
  () => {
    const expected = JSON.parse(read('package.json')).version;
    const lock = JSON.parse(read('package-lock.json'));
    assert.equal(lock.version, expected);
    assert.equal(lock.packages[''].version, expected);
    assert.ok(read('README.md')
      .startsWith(`# Whisky Collection Manager v${expected}\n`));
    assert.ok(read('docs/TESTSTATUS.md')
      .startsWith(`# Teststatus - Whisky Collection Manager v${expected}\n`));
    const changelog = read('CHANGELOG.md');
    assert.match(changelog, /^# Changelog\s*\n/);
    // develop may list upcoming work before the latest released entry.
    // Release snapshots are still validated strictly by
    // verifyReleaseMetadata().
    const sections = [...changelog.matchAll(/^## (.+)$/gm)]
      .map(([, heading]) => heading);
    const latestRelease = sections[0] === 'Unreleased (develop)' ?
      sections[1] : sections[0];
    assert.match(
      latestRelease ?? '',
      new RegExp(`^${expected.replaceAll('.', '\\.')} - \\d{4}-\\d{2}-\\d{2}$`)
    );
    assert.equal(readSourceManifest('.').version, expected);
    // Full source fingerprints are checked only on immutable release snapshots,
    // not on develop where application files are intentionally changing.
  }
);

test(
  'release ZIP rejects secrets but retains source and example config',
  () => {
    for (const unsafe of [
      '.env',
      'deploy/.env',
      'certs/server-key.pem',
      'data/collection.json',
      'images/bottle.png',
      'documents/receipt.pdf',
      'backups/2026.zip',
      'deploy/storage/data/collection.json',
      'deploy/secrets/restic-password',
      'deploy/rclone/rclone.conf',
      'deploy/backup-control/profiles.json',
      'deploy/backup-control/backup-zip-password',
      'node_modules/foo.js',
      '.offline/npm-cache/data',
      '../data/collection.json',
    ]) assert.ok(prohibitedReleasePath(unsafe), unsafe);
    for (const safe of [
      '.env.example', 'deploy/.env.example', 'package.json',
      'public/assets/logo-original.svg', 'public/index.html',
      'public/js/features/backups/controller.js', 'docker-compose.yml',
      '.github/workflows/release.yml',
    ]) assert.equal(prohibitedReleasePath(safe), false, safe);
  }
);


test(
  'README heading can be repaired without relaxing CI metadata validation',
  () => {
    const version = '0.8.8';
    assert.equal(
      updateReadmeTitle('# Whisky Collection Manager\n\nText', version),
      '# Whisky Collection Manager v0.8.8\n\nText'
    );
    assert.equal(
      updateReadmeTitle('# Whisky Collection Manager v0.8.7\n\nText', version),
      '# Whisky Collection Manager v0.8.8\n\nText'
    );
    assert.equal(
      updateReadmeTitle('# Project overview\n\nText', version),
      '# Whisky Collection Manager v0.8.8\n\nText'
    );
    assert.equal(
      updateReadmeTitle('Text only', version),
      '# Whisky Collection Manager v0.8.8\n\nText only'
    );
    assert.equal(
      (updateReadmeTitle('# Other title\n', version).match(/^# /gm) ||
        []).length,
      1
    );
  }
);


test(
  'release:bump resets current test status and records history only in \
changelog',
  () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-release-bump-'));
    try {
      fs.mkdirSync(path.join(temp, 'scripts'));
      fs.mkdirSync(path.join(temp, 'docs'));
      fs.copyFileSync(
        'scripts/release-version.js',
        path.join(temp, 'scripts/release-version.js')
      );
      fs.copyFileSync(
        'scripts/release-manifest.js',
        path.join(temp, 'scripts/release-manifest.js')
      );
      fs.writeFileSync(
        path.join(temp, 'package.json'),
        JSON.stringify({type: 'module', version: '0.16.11'})
      );
      fs.writeFileSync(
        path.join(temp, 'package-lock.json'),
        JSON.stringify({
          version: '0.16.11', packages: {
            '': {version: '0.16.11'},
          },
        })
      );
      fs.writeFileSync(
        path.join(temp, 'README.md'),
        '# Whisky Collection Manager v0.16.11\n'
      );
      fs.writeFileSync(
        path.join(temp, 'CHANGELOG.md'),
        '# Changelog\n\n## 0.16.11 - 2026-11-12\n\n- Previous fix\n'
      );
      fs.writeFileSync(
        path.join(temp, 'docs/TESTSTATUS.md'),
        '# Teststatus - Whisky Collection Manager v0.16.11\n\n## \
Durchgefuehrte Pruefungen\n\n- 341/341 bestanden\n'
      );
      execFileSync(
        process.execPath,
        [
          path.join(temp, 'scripts/release-version.js'),
          'bump',
          'patch',
          'CI-Korrektur',
        ],
        {cwd: temp}
      );
      execFileSync(
        process.execPath,
        [path.join(temp, 'scripts/release-version.js'), 'check'],
        {cwd: temp}
      );
      assert.equal(
        JSON.parse(fs.readFileSync(path.join(temp, 'package.json'), 'utf8'))
          .version,
        '0.16.12'
      );
      const status = fs.readFileSync(path.join(temp, 'docs/TESTSTATUS.md'),
        'utf8');
      assert.match(
        status,
        /^# Teststatus - Whisky Collection Manager v0\.16\.12\n/
      );
      assert.match(status, /npm test[^\n]*Noch nicht ausgeführt/);
      assert.doesNotMatch(status, /341\/341 bestanden/);
      assert.match(
        fs.readFileSync(path.join(temp, 'CHANGELOG.md'), 'utf8'),
        /## 0\.16\.11/
      );
      assert.equal(
        fs.existsSync(path.join(temp, 'docs/TESTHISTORIE.md')),
        false
      );
      fs.writeFileSync(
        path.join(temp, 'docs/TESTSTATUS.md'),
        '# Teststatus - Whisky Collection Manager v0.16.11\n'
      );
      assert.throws(() => verifyReleaseMetadata(temp), /docs\/TESTSTATUS\.md/);
    } finally {
      fs.rmSync(temp, {recursive: true, force: true});
    }
  }
);

test('pending test report is truthful and retains browser visibility', () => {
  const doc = pendingTestStatus('0.16.13', 'Kleinere Korrektur', '2026-11-13');
  assert.match(doc, /v0\.16\.13/);
  assert.match(doc, /npm test[^\n]*Noch nicht ausgeführt/);
  assert.match(doc, /npm run test:browser[^\n]*Nicht lokal ausgeführt/);
  assert.match(doc, /CHANGELOG\.md/);
  assert.doesNotMatch(doc, /TESTHISTORIE/);
});
