import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {CollectionCommitError, COLLECTION_FILES, loadCollectionFiles, writeCollectionFiles, hasCollectionTransaction, recoverCollectionTransaction} from '../../server/storage/collection-files.js';
import {spawnSync} from 'node:child_process';
import {normalizeStandaloneTasting} from '../../shared/standalone-tastings.js';

const fixture = () => ({schemaVersion: 10, nextInventoryNumber: 1, reservedInventoryNumbers: [], distilleries: [], bottlings: [], settings: {establishedYear: null}, externalTastings: [], tastingFlights: []});

const temporary = () => fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-collection-files-'));

test('separate documents reject missing, unsupported and conflicting data instead of inventing empty lists', () => {
  const directory = temporary();
  try {
    const collection = fixture();
    writeCollectionFiles(directory, collection);
    assert.deepEqual(loadCollectionFiles(directory).collection, collection);
    const filename = path.join(directory, 'tastingFlights.json');
    fs.unlinkSync(filename);
    assert.throws(() => loadCollectionFiles(directory), {code: 'ENOENT'});
    fs.writeFileSync(filename, JSON.stringify({schemaVersion: 2, tastingFlights: []}));
    assert.throws(() => loadCollectionFiles(directory), /unsupported collection part/);
    writeCollectionFiles(directory, collection);
    const core = path.join(directory, 'collection.json');
    fs.writeFileSync(core, JSON.stringify(collection));
    assert.throws(() => loadCollectionFiles(directory), /Duplicate collection data/);
    fs.writeFileSync(core, JSON.stringify({...collection, schemaVersion: 7}));
    assert.throws(() => loadCollectionFiles(directory), /conflicting separate data/);
  } finally {fs.rmSync(directory, {recursive: true, force: true});}
});

test('changing only settings or distilleries never replaces unrelated files', t => {
  const directory = temporary();
  try {
    const before = fixture();
    writeCollectionFiles(directory, before);
    const rename = fs.renameSync;
    const names = [];
    t.mock.method(fs, 'renameSync', (from, to) => {names.push(path.basename(to)); return rename(from, to);});
    const after = {...before, settings: {establishedYear: 1999}};
    writeCollectionFiles(directory, after, before);
    assert.deepEqual(names, ['settings.json']);
    assert.deepEqual(loadCollectionFiles(directory).collection, after);
    names.length = 0;
    const multi = {...after, nextInventoryNumber: 3, settings: {establishedYear: 2000}};
    writeCollectionFiles(directory, multi, after);
    assert.deepEqual(names, ['.collection-transaction.json', 'collection.json', 'settings.json']);
    assert.deepEqual(loadCollectionFiles(directory).collection, multi);
    names.length = 0;
    const catalog = {...multi, distilleries: [{id: 'site-a', name: 'New Site'}]};
    writeCollectionFiles(directory, catalog, multi);
    assert.deepEqual(names, ['distilleries.json']);
    assert.deepEqual(loadCollectionFiles(directory).collection, catalog);
  } finally {fs.rmSync(directory, {recursive: true, force: true});}
});

for (const target of COLLECTION_FILES) {
  test(`published multi-file commit recovers after failure replacing ${target}`, t => {
    const directory = temporary();
    try {
      const before = fixture();
      writeCollectionFiles(directory, before);
      const stamp = '2026-11-15T12:00:00.000Z';
      const external = {id: 'external-a', createdAt: stamp, updatedAt: stamp, ...normalizeStandaloneTasting({bottling: {name: 'External'}, tastedOn: '2026-11-15', rating: 88})};
      const flight = {id: 'flight-a', name: 'Session', date: '2026-11-15', notes: '', tastingIds: [external.id], createdAt: stamp, updatedAt: stamp};
      const after = {...before, nextInventoryNumber: 3, settings: {establishedYear: 1999}, externalTastings: [external], tastingFlights: [flight], distilleries: [{id: 'site-a', name: 'New Site'}]};
      const rename = fs.renameSync;
      let fail = true;
      t.mock.method(fs, 'renameSync', (from, to) => {
        if (fail && path.basename(to) === target) throw Object.assign(Error('Injected ENOSPC'), {code: 'ENOSPC'});
        return rename(from, to);
      });
      assert.throws(() => writeCollectionFiles(directory, after, before), error => error instanceof CollectionCommitError && error.code === 'api.errors.collectionCommitPending');
      assert.equal(hasCollectionTransaction(directory), true);
      assert.throws(() => loadCollectionFiles(directory), /Unfinished collection transaction/);
      assert.throws(() => recoverCollectionTransaction(directory), /Injected ENOSPC/);
      assert.equal(hasCollectionTransaction(directory), true);
      fail = false;
      recoverCollectionTransaction(directory);
      assert.equal(hasCollectionTransaction(directory), false);
      assert.deepEqual(loadCollectionFiles(directory).collection, after);
      recoverCollectionTransaction(directory);
      assert.deepEqual(loadCollectionFiles(directory).collection, after);
    } finally {fs.rmSync(directory, {recursive: true, force: true});}
  });
}

const journalName = '.collection-transaction.json';
const changedFixture = before => {
  const stamp = '2026-11-15T12:00:00.000Z';
  const external = {id: 'external-a', createdAt: stamp, updatedAt: stamp, ...normalizeStandaloneTasting({bottling: {name: 'External'}, tastedOn: '2026-11-15', rating: 88})};
  const flight = {id: 'flight-a', name: 'Session', date: '2026-11-15', notes: '', tastingIds: [external.id], createdAt: stamp, updatedAt: stamp};
  return {...before, nextInventoryNumber: 3, settings: {establishedYear: 2001}, distilleries: [{id: 'site-a', name: 'New Site'}], externalTastings: [external], tastingFlights: [flight]};
};

test('a transient replay error is retried without reporting a failed commit', t => {
  const directory = temporary();
  try {
    const before = fixture();
    writeCollectionFiles(directory, before);
    const after = changedFixture(before);
    const rename = fs.renameSync;
    let failed = false;
    t.mock.method(fs, 'renameSync', (from, to) => {
      if (!failed && path.basename(to) === 'settings.json') {failed = true; throw Error('transient rename failure');}
      return rename(from, to);
    });
    assert.equal(writeCollectionFiles(directory, after, before), 'complete');
    assert.equal(failed, true);
    assert.deepEqual(loadCollectionFiles(directory).collection, after);
  } finally {fs.rmSync(directory, {recursive: true, force: true});}
});

test('a durable commit remains successful when removing its journal repeatedly fails', t => {
  const directory = temporary();
  try {
    const before = fixture();
    writeCollectionFiles(directory, before);
    const after = changedFixture(before);
    const unlink = fs.unlinkSync;
    let fail = true;
    t.mock.method(fs, 'unlinkSync', filename => {
      if (fail && path.basename(filename) === journalName) throw Error('cleanup failed');
      return unlink(filename);
    });
    assert.equal(writeCollectionFiles(directory, after, before), 'pending');
    assert.equal(hasCollectionTransaction(directory), true);
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'collection.json'))).nextInventoryNumber, 3);
    fail = false;
    assert.equal(recoverCollectionTransaction(directory), 'complete');
    assert.deepEqual(loadCollectionFiles(directory).collection, after);
  } finally {fs.rmSync(directory, {recursive: true, force: true});}
});

test('failure of final journal directory sync does not turn a completed commit into a failure', {skip: process.platform === 'win32'}, t => {
  const directory = temporary();
  try {
    const before = fixture();
    writeCollectionFiles(directory, before);
    const after = changedFixture(before);
    const sync = fs.fsyncSync;
    const unlink = fs.unlinkSync;
    let removed = false;
    t.mock.method(fs, 'unlinkSync', filename => {
      const result = unlink(filename);
      if (path.basename(filename) === journalName) removed = true;
      return result;
    });
    t.mock.method(fs, 'fsyncSync', fd => {
      if (removed && fs.fstatSync(fd).isDirectory()) throw Error('final sync failed');
      return sync(fd);
    });
    assert.equal(writeCollectionFiles(directory, after, before), 'syncUnconfirmed');
    assert.equal(hasCollectionTransaction(directory), false);
    assert.deepEqual(loadCollectionFiles(directory).collection, after);
  } finally {fs.rmSync(directory, {recursive: true, force: true});}
});

test('unconfirmed journal publication preserves the previous files and provides an explicit uncertain outcome', {skip: process.platform === 'win32'}, t => {
  const directory = temporary();
  try {
    const before = fixture();
    writeCollectionFiles(directory, before);
    const after = changedFixture(before);
    const sync = fs.fsyncSync;
    let fail = true;
    t.mock.method(fs, 'fsyncSync', fd => {
      if (fail && fs.fstatSync(fd).isDirectory() && hasCollectionTransaction(directory)) throw Error('journal sync failed');
      return sync(fd);
    });
    assert.throws(() => writeCollectionFiles(directory, after, before), error => error.code === 'api.errors.collectionCommitUnconfirmed' && error.status === 503);
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'collection.json'))).nextInventoryNumber, before.nextInventoryNumber);
    assert.equal(hasCollectionTransaction(directory), true);
    fail = false;
    recoverCollectionTransaction(directory);
    assert.deepEqual(loadCollectionFiles(directory).collection, after);
  } finally {fs.rmSync(directory, {recursive: true, force: true});}
});

test('each individual file and directory flush failure is recoverable or leaves the original untouched', t => {
  const sync = fs.fsyncSync;
  const before = fixture();
  const after = changedFixture(before);
  let count = 0;
  const reference = temporary();
  const mock = t.mock.method(fs, 'fsyncSync', fd => {count++; return sync(fd);});
  try {
    writeCollectionFiles(reference, before);
    count = 0;
    writeCollectionFiles(reference, after, before);
    const flushes = count;
    mock.mock.restore();
    assert.ok(flushes >= 4);
    for (let step = 1; step <= flushes; step++) {
      const directory = temporary();
      try {
        writeCollectionFiles(directory, before);
        let calls = 0;
        const injected = t.mock.method(fs, 'fsyncSync', fd => {
          if (++calls === step) throw Object.assign(Error('injected flush failure'), {code: 'EIO'});
          return sync(fd);
        });
        let error;
        try {writeCollectionFiles(directory, after, before);} catch (cause) {error = cause;}
        finally {injected.mock.restore();}
        assert.ok(calls >= step);
        if (hasCollectionTransaction(directory)) recoverCollectionTransaction(directory);
        assert.deepEqual(loadCollectionFiles(directory).collection, error && !(error instanceof CollectionCommitError) ? before : after);
      } finally {fs.rmSync(directory, {recursive: true, force: true});}
    }
  } finally {fs.rmSync(reference, {recursive: true, force: true});}
});

test('partial journal write with ENOSPC leaves the original collection unchanged', t => {
  const directory = temporary();
  try {
    const before = fixture();
    writeCollectionFiles(directory, before);
    const write = fs.writeFileSync;
    t.mock.method(fs, 'writeFileSync', (fd, content, ...args) => {
      if (typeof fd === 'number') {
        fs.writeSync(fd, String(content).slice(0, 15));
        throw Object.assign(Error('injected ENOSPC'), {code: 'ENOSPC'});
      }
      return write(fd, content, ...args);
    });
    assert.throws(() => writeCollectionFiles(directory, changedFixture(before), before), {code: 'ENOSPC'});
    assert.equal(hasCollectionTransaction(directory), false);
    assert.deepEqual(loadCollectionFiles(directory).collection, before);
    assert.deepEqual(fs.readdirSync(directory).sort(), [...COLLECTION_FILES].sort());
  } finally {fs.rmSync(directory, {recursive: true, force: true});}
});

for (const target of [journalName, ...COLLECTION_FILES]) {
  test(`process termination after publishing ${target} leaves an idempotent redo record`, {skip: process.platform === 'win32'}, () => {
    const directory = temporary();
    try {
      const before = fixture();
      const after = changedFixture(before);
      writeCollectionFiles(directory, before);
      const script = `import fs from 'node:fs'; import path from 'node:path'; import {writeCollectionFiles} from ${JSON.stringify(new URL('../../server/storage/collection-files.js', import.meta.url).href)}; const rename=fs.renameSync; fs.renameSync=(from,to)=>{rename(from,to); if(path.basename(to)===${JSON.stringify(target)}) process.kill(process.pid,'SIGKILL');}; writeCollectionFiles(${JSON.stringify(directory)},${JSON.stringify(after)},${JSON.stringify(before)});`;
      const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], {encoding: 'utf8'});
      assert.equal(child.signal, 'SIGKILL', child.stderr);
      assert.equal(hasCollectionTransaction(directory), true);
      assert.equal(recoverCollectionTransaction(directory), 'complete');
      assert.equal(recoverCollectionTransaction(directory), 'complete');
      assert.deepEqual(loadCollectionFiles(directory).collection, after);
    } finally {fs.rmSync(directory, {recursive: true, force: true});}
  });
}
