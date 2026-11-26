import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {COLLECTION_FILES, loadCollectionFiles, writeCollectionFiles, hasCollectionTransaction, recoverCollectionTransaction} from '../../server/storage/collection-files.js';
import {PublishedWriteError} from '../../shared/durable-files.js';
import {normalizeStandaloneTasting} from '../../shared/standalone-tastings.js';

const fixture = () => ({schemaVersion: 8, nextInventoryNumber: 1, reservedInventoryNumbers: [], distilleries: [], bottlings: [], settings: {establishedYear: null}, externalTastings: [], tastingFlights: []});

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

test('changing only settings never replaces the other three files', t => {
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
      const after = {...before, nextInventoryNumber: 3, settings: {establishedYear: 1999}, externalTastings: [external], tastingFlights: [flight]};
      const rename = fs.renameSync;
      let fail = true;
      t.mock.method(fs, 'renameSync', (from, to) => {
        if (fail && path.basename(to) === target) throw Object.assign(Error('Injected ENOSPC'), {code: 'ENOSPC'});
        return rename(from, to);
      });
      assert.throws(() => writeCollectionFiles(directory, after, before), PublishedWriteError);
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
