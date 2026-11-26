import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {RESTORE_FOLDERS, installRestore, restoreDirectories, recoverInterruptedRestore, hasInterruptedRestore} from '../../server/storage/restore-transaction.js';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-restore-transaction-'));
  const id = crypto.randomUUID();
  const {fresh, parked} = restoreDirectories(root, id);
  for (const name of RESTORE_FOLDERS) {
    for (const [base, content] of [[root, 'old'], [fresh, 'new']]) {
      fs.mkdirSync(path.join(base, name), {recursive: true});
      fs.writeFileSync(path.join(base, name, 'version.txt'), `${content}-${name}`);
    }
  }
  return {root, id, fresh, parked};
}

function verifyVersion(root, version) {
  for (const name of RESTORE_FOLDERS) assert.equal(fs.readFileSync(path.join(root, name, 'version.txt'), 'utf8'), `${version}-${name}`);
  assert.equal(hasInterruptedRestore(root), false);
  assert.equal(fs.readdirSync(root).some(name => name.startsWith('.restore-old-') || name.startsWith('.restore-new-')), false);
}

function childRun(root, id, source) {
  return spawnSync(process.execPath, ['--input-type=module', '-e', source, root, id, new URL('../../server/storage/restore-transaction.js', import.meta.url).href], {encoding: 'utf8', timeout: 15000});
}

function interruptInstall(root, id, afterRename) {
  const child = childRun(root, id, `
    import fs from 'node:fs';
    const {installRestore} = await import(process.argv[3]);
    const rename = fs.renameSync;
    let count = 0;
    fs.renameSync = (...args) => {
      rename(...args);
      if (++count === ${afterRename}) process.kill(process.pid, 'SIGKILL');
    };
    installRestore(process.argv[1], process.argv[2]);
  `);
  assert.equal(child.signal, 'SIGKILL', child.stderr);
  assert.equal(hasInterruptedRestore(root), true);
}

test('restore rolls back or commits coherently after process death at every journal and directory rename', () => {
  // Prepared marker, three old/new directory pairs, committed marker.
  for (let step = 1; step <= 8; step++) {
    const {root, id} = fixture();
    try {
      interruptInstall(root, id, step);
      const committed = step === 8;
      assert.equal(recoverInterruptedRestore(root), committed ? 'committed' : 'rolledBack', `rename ${step}`);
      verifyVersion(root, committed ? 'new' : 'old');
      assert.equal(recoverInterruptedRestore(root), null, 'recovery must be repeatable');
    } finally {fs.rmSync(root, {recursive: true, force: true});}
  }
});

test('restore rollback remains recoverable if the recovery process itself dies', () => {
  const {root, id} = fixture();
  try {
    interruptInstall(root, id, 7);
    const child = childRun(root, id, `
      import fs from 'node:fs';
      const {recoverInterruptedRestore} = await import(process.argv[3]);
      const rename = fs.renameSync;
      fs.renameSync = (...args) => {rename(...args); process.kill(process.pid, 'SIGKILL');};
      recoverInterruptedRestore(process.argv[1]);
    `);
    assert.equal(child.signal, 'SIGKILL', child.stderr);
    assert.equal(recoverInterruptedRestore(root), 'rolledBack');
    verifyVersion(root, 'old');
  } finally {fs.rmSync(root, {recursive: true, force: true});}
});

test('restore completes cleanup after a committed restore loses its process during cleanup', () => {
  const {root, id} = fixture();
  try {
    interruptInstall(root, id, 8);
    const child = childRun(root, id, `
      import fs from 'node:fs';
      const {recoverInterruptedRestore} = await import(process.argv[3]);
      const rm = fs.rmSync;
      fs.rmSync = (...args) => {
        rm(...args);
        if (String(args[0]).includes('.restore-old-')) process.kill(process.pid, 'SIGKILL');
      };
      recoverInterruptedRestore(process.argv[1]);
    `);
    assert.equal(child.signal, 'SIGKILL', child.stderr);
    assert.equal(recoverInterruptedRestore(root), 'committed');
    verifyVersion(root, 'new');
  } finally {fs.rmSync(root, {recursive: true, force: true});}
});

test('restore rolls back an ordinary filesystem error and permits a subsequent successful restore', t => {
  const {root, id} = fixture();
  const rename = fs.renameSync;
  let failed = false;
  const mock = t.mock.method(fs, 'renameSync', (source, destination) => {
    if (!failed && source.includes('.restore-new-') && source.endsWith('images')) {
      failed = true;
      throw Error('simulated rename failure');
    }
    return rename(source, destination);
  });
  try {
    assert.throws(() => installRestore(root, id), /simulated rename failure/);
    verifyVersion(root, 'old');
    mock.mock.restore();
    const next = crypto.randomUUID();
    const {fresh} = restoreDirectories(root, next);
    for (const name of RESTORE_FOLDERS) {
      fs.mkdirSync(path.join(fresh, name), {recursive: true});
      fs.writeFileSync(path.join(fresh, name, 'version.txt'), `new-${name}`);
    }
    installRestore(root, next);
    verifyVersion(root, 'new');
  } finally {fs.rmSync(root, {recursive: true, force: true});}
});

test('restore rejects an ambiguous unjournaled legacy rollback directory without deleting original data', () => {
  const {root, parked} = fixture();
  try {
    fs.mkdirSync(parked);
    fs.renameSync(path.join(root, 'data'), path.join(parked, 'data'));
    assert.throws(() => recoverInterruptedRestore(root), /manual recovery required/);
    assert.equal(fs.readFileSync(path.join(parked, 'data/version.txt'), 'utf8'), 'old-data');
    assert.equal(fs.existsSync(path.join(root, 'data')), false);
  } finally {fs.rmSync(root, {recursive: true, force: true});}
});

test('restore discards interrupted preparation without a journal and refuses malformed journal paths', () => {
  const {root, fresh} = fixture();
  try {
    assert.equal(recoverInterruptedRestore(root), null);
    assert.equal(fs.existsSync(fresh), false);
    verifyVersion(root, 'old');
    const journal = path.join(root, '.restore-transaction.json');
    fs.writeFileSync(journal, JSON.stringify({version: 1, id: '../outside', phase: 'prepared', originals: ['data']}));
    assert.throws(() => recoverInterruptedRestore(root), /Invalid restore journal/);
    assert.equal(fs.existsSync(journal), true);
    assert.equal(fs.readFileSync(path.join(root, 'data/version.txt'), 'utf8'), 'old-data');
  } finally {fs.rmSync(root, {recursive: true, force: true});}
});

test('application startup restores parked data before initializing collection, warehouse or users', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-restore-startup-'));
  const id = crypto.randomUUID();
  const env = {...process.env, WHISKY_DATA_DIR: root, HTTP_ENABLED: 'true', HTTPS_ENABLED: 'false'};
  const start = () => spawnSync(process.execPath, ['--input-type=module', '-e',
    'const {createRequestHandler} = await import(process.argv[1]); createRequestHandler();', new URL('../../server/app.js', import.meta.url).href], {env, encoding: 'utf8', timeout: 15000});
  try {
    const original = start();
    assert.equal(original.status, 0, original.stderr);
    const before = ['collection.json', 'warehouse.json', 'user.json'].map(name => fs.readFileSync(path.join(root, 'data', name)));
    const {fresh} = restoreDirectories(root, id);
    fs.mkdirSync(fresh);
    for (const name of RESTORE_FOLDERS) fs.cpSync(path.join(root, name), path.join(fresh, name), {recursive: true});
    // At rename 2 data/ has been parked, but no replacement exists yet.
    interruptInstall(root, id, 2);
    assert.equal(fs.existsSync(path.join(root, 'data')), false);
    const restarted = start();
    assert.equal(restarted.status, 0, restarted.stderr);
    assert.equal(hasInterruptedRestore(root), false);
    assert.deepEqual(['collection.json', 'warehouse.json', 'user.json'].map(name => fs.readFileSync(path.join(root, 'data', name))), before);
    assert.doesNotMatch(restarted.stdout, /WCM Erstzugang/);
  } finally {fs.rmSync(root, {recursive: true, force: true});}
});
