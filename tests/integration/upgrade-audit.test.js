import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {auditUpgrade, pruneObsolete} from '../../scripts/upgrade-audit.js';

function withReleases(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-upgrade-audit-'));
  const previous = path.join(root, 'previous');
  const next = path.join(root, 'next');
  const installed = path.join(root, 'installed');
  for (const dir of [previous, next, installed]) fs.mkdirSync(dir);
  const put = (dir, name, content) => {
    const file = path.join(dir, name);
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, content);
    return file;
  };
  try {return fn({previous, next, installed, put});}
  finally {fs.rmSync(root, {recursive: true, force: true});}
}

test(
  'upgrade audit reports obsolete release modules but never modifies installation in dry run',
  () => withReleases(({previous, next, installed, put}) => {
    for (const dir of [previous, installed]) {
      put(dir, 'public/js/obsolete.js', 'old module');
      put(dir, 'public/js/retained.js', 'keep');
    }
    put(next, 'public/js/retained.js', 'new version');
    put(installed, 'collection.json', 'important original data');
    put(installed, 'server/custom.js', 'personal custom code');
    assert.deepEqual(auditUpgrade(previous, next, installed), {
      removable: ['public/js/obsolete.js'], changed: [], absent: [],
    });
    assert.equal(
      fs.readFileSync(path.join(installed, 'public/js/obsolete.js'), 'utf8'),
      'old module'
    );
    assert.equal(
      fs.readFileSync(path.join(installed, 'collection.json'), 'utf8'),
      'important original data'
    );
  })
);

test(
  'explicit prune removes only obsolete unmodified modules; unrelated data and modified code survive',
  () => withReleases(({previous, next, installed, put}) => {
    put(previous, 'server/obsolete.js', 'old');
    put(installed, 'server/obsolete.js', 'old');
    put(previous, 'shared/edited.js', 'old');
    put(installed, 'shared/edited.js', 'locally modified');
    put(previous, 'worker/gone.js', 'old');
    put(previous, 'public/js/live.js', 'old');
    put(next, 'public/js/live.js', 'new');
    put(installed, 'public/js/live.js', 'old');
    put(installed, 'warehouse.json', 'warehouse must survive');
    put(installed, 'images/photo.png', 'photo bytes');
    const report = pruneObsolete(previous, next, installed);
    assert.deepEqual(report.removable, ['server/obsolete.js']);
    assert.deepEqual(report.changed, ['shared/edited.js']);
    assert.deepEqual(report.absent, ['worker/gone.js']);
    assert.equal(
      fs.existsSync(path.join(installed, 'server/obsolete.js')),
      false
    );
    assert.equal(
      fs.readFileSync(path.join(installed, 'shared/edited.js'), 'utf8'),
      'locally modified'
    );
    assert.equal(
      fs.readFileSync(path.join(installed, 'warehouse.json'), 'utf8'),
      'warehouse must survive'
    );
    assert.equal(
      fs.readFileSync(path.join(installed, 'images/photo.png'), 'utf8'),
      'photo bytes'
    );
  })
);

test(
  'audit never follows symlinked installation source folders',
  {skip: process.platform === 'win32'},
  () => withReleases(({previous, next, installed, put}) => {
    put(previous, 'public/js/obsolete.js', 'old');
    const outside = path.join(installed, 'data');
    put(installed, 'data/obsolete.js', 'old');
    fs.mkdirSync(path.join(installed, 'public'), {recursive: true});
    fs.symlinkSync(outside, path.join(installed, 'public/js'), 'dir');
    const report = pruneObsolete(previous, next, installed);
    assert.deepEqual(report.removable, []);
    assert.deepEqual(report.absent, ['public/js/obsolete.js']);
    assert.equal(
      fs.readFileSync(path.join(outside, 'obsolete.js'), 'utf8'),
      'old'
    );
  })
);
