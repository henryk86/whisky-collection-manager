import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  sourceManifest, writeSourceManifest, readSourceManifest,
  verifySourceManifest
} from '../../scripts/release-manifest.js';
import {inspectManifestUpgrade} from '../../scripts/upgrade-manifest.js';
import {verifyReleaseMetadata} from '../../scripts/release-version.js';

/**
 * Derives the hash result from the supplied values.
 *
 * @param {*} value Value to process.
 * @return {*} Result computed from the supplied inputs.
 */
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

/**
 * Writes fixture data to the local filesystem.
 *
 * @param {*} root Root node or directory for the operation.
 * @param {*} version Value used by this operation.
 * @param {*} modules Value used by this operation.
 */
function fixture(root, version, modules) {
  fs.mkdirSync(root, {recursive: true});
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({version}));
  for (const [name, contents] of Object.entries(modules)) {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, contents);
  }
  writeSourceManifest(root);
}

test(
  'release manifest fingerprints actual source tree independently of process working directory',
  () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-manifest-root-'));
    try {
      fixture(
        root,
        '2.0.0',
        {
          'public/js/stable.js': 'stable',
          'server/route.js': 'route',
          'shared/data.json': '{}',
          'data/private.json': 'secret',
        }
      );
      assert.deepEqual(sourceManifest(root).files, {
        'public/js/stable.js': hash('stable'),
        'server/route.js': hash('route'),
        'shared/data.json': hash('{}'),
      });
      assert.equal(verifySourceManifest(root).version, '2.0.0');
      fs.writeFileSync(path.join(root, 'shared/data.json'), 'changed');
      assert.throws(() => verifySourceManifest(root), /differs/);
      writeSourceManifest(root);
      assert.doesNotThrow(() => verifySourceManifest(root));
    } finally {fs.rmSync(root, {recursive: true, force: true});}
  }
);

test(
  'ZIP upgrade audit preserves user data, modified modules, and symlinks; removes only unchanged obsolete sources',
  () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-upgrade-audit-'));
    const old = path.join(root, 'old');
    const next = path.join(root, 'new');
    try {
      fixture(old, '1.0.0', {
        'server/stable.js': 'same',
        'public/js/obsolete.js': 'old',
        'server/customized.js': 'before',
        'shared/symlink.js': 'link-original',
        'public/js/missing.js': 'missing-original',
        'data/collection.json': 'precious records',
        'data/warehouse.json': 'precious inventory',
      });
      fixture(next, '1.1.0', {'server/stable.js': 'same', 'public/js/new.js': 'new'});
      fs.writeFileSync(path.join(old, 'server/customized.js'), 'locally customized');
      fs.unlinkSync(path.join(old, 'shared/symlink.js'));
      fs.symlinkSync(path.join(old, 'data/collection.json'), path.join(old, 'shared/symlink.js'));
      fs.unlinkSync(path.join(old, 'public/js/missing.js'));
      const audit = inspectManifestUpgrade(next, old);
      assert.deepEqual(audit.removable, ['public/js/obsolete.js']);
      assert.deepEqual(audit.modified, ['server/customized.js']);
      assert.deepEqual(audit.missing, ['public/js/missing.js', 'shared/symlink.js']);
      assert.ok(fs.existsSync(path.join(old, 'public/js/obsolete.js')), 'dry-run must not delete code');
      const prune = inspectManifestUpgrade(next, old, true);
      assert.deepEqual(prune.removed, ['public/js/obsolete.js']);
      assert.equal(fs.existsSync(path.join(old, 'public/js/obsolete.js')), false);
      assert.equal(fs.readFileSync(path.join(old, 'data/collection.json'), 'utf8'), 'precious records');
      assert.equal(fs.readFileSync(path.join(old, 'data/warehouse.json'), 'utf8'), 'precious inventory');
      assert.equal(fs.readFileSync(path.join(old, 'server/customized.js'), 'utf8'), 'locally customized');
      assert.ok(fs.lstatSync(path.join(old, 'shared/symlink.js')).isSymbolicLink());
    } finally {fs.rmSync(root, {recursive: true, force: true});}
  }
);

test(
  'manifest parser rejects dangerous relative paths and malformed fingerprints',
  () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-manifest-unsafe-'));
    try {
      fixture(root, '1.0.0', {'server/legit.js': 'safe'});
      for (const item of [
        'server/../data/collection.json',
        'server/.',
        'data/private.json',
        'public/js/x\\name.js',
      ]) {
        fs.writeFileSync(
          path.join(root, 'wcm-source-manifest.json'),
          JSON.stringify({
            schema: 1, version: '1.0.0', files: {[item]: hash('bad'), },
          })
        );
        assert.throws(() => readSourceManifest(root), /Unsafe/);
      }
      fs.writeFileSync(
        path.join(root, 'wcm-source-manifest.json'),
        JSON.stringify({
          schema: 1, version: '1.0.0', files: {'server/legit.js': 'invalid', },
        })
      );
      assert.throws(() => readSourceManifest(root), /Unsafe/);
    } finally {fs.rmSync(root, {recursive: true, force: true});}
  }
);

test(
  'release metadata requires a verified source manifest for modern releases',
  () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-release-verified-'));
    try {
      fixture(root, '1.3.0', {'server/service.js': 'original'});
      fs.writeFileSync(
        path.join(root, 'package-lock.json'),
        JSON.stringify({version: '1.3.0', packages: {'': {version: '1.3.0'}}})
      );
      fs.writeFileSync(path.join(root, 'README.md'), '# Whisky Collection Manager v1.3.0\n');
      fs.writeFileSync(path.join(root, 'README.en.md'), '# Whisky Collection Manager v1.3.0\n');
      fs.writeFileSync(path.join(root, 'CHANGELOG.md'), '# Changelog\n\n## 1.3.0 - 2026-11-16\n\n- Fixes\n');
      fs.mkdirSync(path.join(root, 'docs'));
      fs.writeFileSync(path.join(root, 'docs/TESTSTATUS.md'), '# Teststatus - Whisky Collection Manager v1.3.0\n');
      assert.equal(verifyReleaseMetadata(root).version, '1.3.0');
      fs.unlinkSync(path.join(root, 'wcm-source-manifest.json'));
      assert.throws(() => verifyReleaseMetadata(root), /Manifest/);
    } finally {fs.rmSync(root, {recursive: true, force: true});}
  }
);
