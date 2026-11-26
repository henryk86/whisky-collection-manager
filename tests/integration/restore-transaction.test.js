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

// Inject failures at the actual filesystem boundary rather than adding fault hooks to production.
function journalPhase(root) {
  const filename = path.join(root, '.restore-transaction.json');
  return fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')).phase : null;
}

function filesystemError(code) {
  return Object.assign(Error(`simulated ${code}`), {code});
}

test('restore preserves the correct generation after a single failure at every file or directory fsync', t => {
  const sync = fs.fsyncSync;
  const probe = fixture();
  const operations = [];
  const mock = t.mock.method(fs, 'fsyncSync', fd => {
    operations.push({directory: fs.fstatSync(fd).isDirectory(), phase: journalPhase(probe.root)});
    return sync(fd);
  });
  try {
    assert.deepEqual(installRestore(probe.root, probe.id), {cleanupStatus: 'complete'});
    verifyVersion(probe.root, 'new');
  } finally {
    mock.mock.restore();
    fs.rmSync(probe.root, {recursive: true, force: true});
  }
  assert.ok(operations.some(operation => !operation.directory));
  if (process.platform !== 'win32') assert.ok(operations.some(operation => operation.directory));
  for (const [index, operation] of operations.entries()) {
    const {root, id} = fixture();
    let count = 0;
    let injected = false;
    const committed = operation.phase === 'committed' || (operation.phase === null && index === operations.length - 1 && operation.directory);
    const fault = t.mock.method(fs, 'fsyncSync', fd => {
      if (count++ === index) {
        assert.equal(fs.fstatSync(fd).isDirectory(), operation.directory);
        assert.equal(journalPhase(root), operation.phase);
        injected = true;
        throw filesystemError('EIO');
      }
      return sync(fd);
    });
    try {
      if (committed) assert.deepEqual(installRestore(root, id), {cleanupStatus: 'complete'}, `fsync ${index + 1}`);
      else assert.throws(() => installRestore(root, id), error => (error.cause || error).code === 'EIO', `fsync ${index + 1}`);
      assert.equal(injected, true);
      verifyVersion(root, committed ? 'new' : 'old');
    } finally {
      fault.mock.restore();
      fs.rmSync(root, {recursive: true, force: true});
    }
  }
});

test('a disk-full error while writing either journal phase preserves the original generation', t => {
  const write = fs.writeFileSync;
  for (const phase of ['prepared', 'committed']) {
    const {root, id} = fixture();
    let injected = false;
    const mock = t.mock.method(fs, 'writeFileSync', (filename, content, ...args) => {
      if (typeof filename === 'number' && typeof content === 'string' && content.includes(`"phase": "${phase}"`)) {
        // Simulate a partial write followed by ENOSPC, not merely failure before opening the file.
        write(filename, content.slice(0, 20), ...args);
        injected = true;
        throw filesystemError('ENOSPC');
      }
      return write(filename, content, ...args);
    });
    try {
      assert.throws(() => installRestore(root, id), {code: 'ENOSPC'});
      assert.equal(injected, true);
      verifyVersion(root, 'old');
      assert.equal(fs.readdirSync(root).some(name => name.endsWith('.tmp')), false);
    } finally {
      mock.mock.restore();
      fs.rmSync(root, {recursive: true, force: true});
    }
  }
});

test('restore cannot acknowledge an unconfirmed commit marker when its directory sync keeps failing', {skip: process.platform === 'win32'}, t => {
  const {root, id, parked} = fixture();
  const sync = fs.fsyncSync;
  const fault = t.mock.method(fs, 'fsyncSync', fd => {
    if (fs.fstatSync(fd).isDirectory() && journalPhase(root) === 'committed') throw filesystemError('EIO');
    return sync(fd);
  });
  try {
    assert.throws(() => installRestore(root, id), {code: 'EIO'});
    assert.equal(journalPhase(root), 'committed');
    for (const name of RESTORE_FOLDERS) assert.equal(fs.readFileSync(path.join(parked, name, 'version.txt'), 'utf8'), `old-${name}`);
    fault.mock.restore();
    assert.equal(recoverInterruptedRestore(root), 'committed');
    verifyVersion(root, 'new');
  } finally {fs.rmSync(root, {recursive: true, force: true});}
});

test('restore reports success if the final journal removal sync keeps failing after a durable commit', {skip: process.platform === 'win32'}, t => {
  const {root, id} = fixture();
  const sync = fs.fsyncSync;
  const unlink = fs.unlinkSync;
  let removed = false;
  t.mock.method(fs, 'unlinkSync', filename => {
    unlink(filename);
    if (filename === path.join(root, '.restore-transaction.json')) removed = true;
  });
  let failures = 0;
  const fault = t.mock.method(fs, 'fsyncSync', fd => {
    if (removed && fs.fstatSync(fd).isDirectory()) {
      failures++;
      throw filesystemError('EIO');
    }
    return sync(fd);
  });
  const warning = t.mock.method(console, 'warn', () => {});
  try {
    assert.deepEqual(installRestore(root, id), {cleanupStatus: 'syncUnconfirmed'});
    assert.equal(failures, 2, 'final sync must be retried');
    assert.equal(warning.mock.callCount(), 1);
    fault.mock.restore();
    verifyVersion(root, 'new');
    assert.equal(recoverInterruptedRestore(root), null);
  } finally {fs.rmSync(root, {recursive: true, force: true});}
});

test('a committed restore with persistently failed cleanup retains its journal until successful recovery', t => {
  const {root, id, parked} = fixture();
  const remove = fs.rmSync;
  let failures = 0;
  const fault = t.mock.method(fs, 'rmSync', (filename, ...args) => {
    if (filename === parked) {
      failures++;
      throw filesystemError('EACCES');
    }
    return remove(filename, ...args);
  });
  const warning = t.mock.method(console, 'warn', () => {});
  try {
    assert.deepEqual(installRestore(root, id), {cleanupStatus: 'pending'});
    assert.equal(failures, 2);
    assert.equal(warning.mock.callCount(), 1);
    assert.equal(journalPhase(root), 'committed');
    assert.throws(() => recoverInterruptedRestore(root), {code: 'EACCES'});
    fault.mock.restore();
    assert.equal(recoverInterruptedRestore(root), 'committed');
    verifyVersion(root, 'new');
  } finally {
    fault.mock.restore();
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test('repeated rollback errors preserve the prepared journal and allow later recovery without data loss', t => {
  const {root, id, fresh, parked} = fixture();
  const rename = fs.renameSync;
  const fault = t.mock.method(fs, 'renameSync', (source, destination) => {
    if (source === path.join(fresh, 'images') || source === path.join(parked, 'images')) throw filesystemError('EIO');
    return rename(source, destination);
  });
  try {
    assert.throws(() => installRestore(root, id), {code: 'EIO'});
    assert.equal(journalPhase(root), 'prepared');
    assert.equal(fs.readFileSync(path.join(parked, 'images', 'version.txt'), 'utf8'), 'old-images');
    assert.throws(() => recoverInterruptedRestore(root), {code: 'EIO'});
    assert.equal(journalPhase(root), 'prepared');
    fault.mock.restore();
    assert.equal(recoverInterruptedRestore(root), 'rolledBack');
    verifyVersion(root, 'old');
  } finally {fs.rmSync(root, {recursive: true, force: true});}
});

test('a durable commit is acknowledged even if inspecting the cleanup journal repeatedly fails', t => {
  const {root, id} = fixture();
  const journal = path.join(root, '.restore-transaction.json');
  const rename = fs.renameSync;
  const stat = fs.lstatSync;
  let committed = false;
  const renameMock = t.mock.method(fs, 'renameSync', (source, destination) => {
    rename(source, destination);
    if (destination === journal && journalPhase(root) === 'committed') committed = true;
  });
  const statMock = t.mock.method(fs, 'lstatSync', filename => {
    if (committed && filename === journal) throw filesystemError('EIO');
    return stat(filename);
  });
  const warning = t.mock.method(console, 'warn', () => {});
  try {
    assert.deepEqual(installRestore(root, id), {cleanupStatus: 'pending'});
    assert.equal(warning.mock.callCount(), 2);
    statMock.mock.restore();
    renameMock.mock.restore();
    assert.equal(recoverInterruptedRestore(root), 'committed');
    verifyVersion(root, 'new');
  } finally {
    t.mock.restoreAll();
    fs.rmSync(root, {recursive: true, force: true});
  }
});
