import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {startTestServer, requestJson as api} from '../helpers/server.js';
import {removeSeparateCollectionFiles} from '../helpers/fixtures.js';
import {loadCollectionFiles} from '../../server/storage/collection-files.js';
import {writeReadableZip, inspectReadableZip} from '../../shared/backup-zip.js';
import {validatePreview} from '../../server/storage/restore-validation.js';

const day = '2026-11-15';

test('schema 7 startup migration preserves all records and produces independently versioned files', async () => {
  const ctx = await startTestServer();
  try {
    const directory = path.join(ctx.dir, 'data');
    const owned = (await api(ctx.base, '/api/bottlings', 'POST', {name: 'Owned'})).data.bottling;
    const note = (await api(ctx.base, `/api/bottlings/${owned.id}/tastings`, 'POST', {tastedOn: day, rating: 88})).data;
    const external = (await api(ctx.base, '/api/external-tastings', 'POST', {bottling: {name: 'External'}, tastedOn: day, rating: 92})).data;
    const flight = (await api(ctx.base, '/api/tasting-flights', 'POST', {name: 'Flight', date: day})).data;
    assert.equal((await api(ctx.base, `/api/tasting-flights/${flight.id}/tastings`, 'PUT', {tastingIds: [external.id, note.id]})).status, 200);
    assert.equal((await api(ctx.base, '/api/settings', 'PATCH', {establishedYear: 1999})).status, 200);
    const snapshot = (await api(ctx.base, '/api/collection')).data;
    const original = Buffer.from(JSON.stringify({...snapshot, schemaVersion: 7}));
    const core = path.join(directory, 'collection.json');
    removeSeparateCollectionFiles(directory);
    fs.writeFileSync(core, original);
    const args = ['--input-type=module', '-e', "import {initialize} from './server/storage/collection-store.js';initialize();"];
    const options = {env: {...process.env, WHISKY_DATA_DIR: ctx.dir}, encoding: 'utf8'};
    const migration = spawnSync(process.execPath, args, options);
    assert.equal(migration.status, 0, migration.stderr);
    assert.deepEqual(loadCollectionFiles(directory).collection, snapshot);
    const stored = JSON.parse(fs.readFileSync(core));
    for (const key of ['settings', 'externalTastings', 'tastingFlights']) {
      assert.equal(Object.hasOwn(stored, key), false);
      assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, `${key}.json`))), {schemaVersion: 1, [key]: snapshot[key]});
    }
    const backupDir = path.join(ctx.dir, 'backups');
    const backups = fs.readdirSync(backupDir).filter(name => name.startsWith('pre-schema8-'));
    assert.equal(backups.length, 1);
    assert.deepEqual(fs.readFileSync(path.join(backupDir, backups[0])), original);
    assert.equal(spawnSync(process.execPath, args, options).status, 0);
    assert.deepEqual(fs.readdirSync(backupDir).filter(name => name.startsWith('pre-schema8-')), backups);
    const download = await fetch(ctx.base + '/api/export/json');
    assert.equal(download.status, 200);
    assert.deepEqual(await download.json(), snapshot);
    const password = 'test-passphrase-123456';
    const archive = path.join(backupDir, 'split.zip');
    const extracted = path.join(ctx.dir, 'extracted');
    writeReadableZip(ctx.dir, archive, password);
    inspectReadableZip(archive, extracted, password);
    assert.equal(validatePreview(extracted).bottlings, 1);
    assert.deepEqual(loadCollectionFiles(path.join(extracted, 'data')).collection, snapshot);
    fs.unlinkSync(path.join(extracted, 'data', 'tastingFlights.json'));
    assert.throws(() => validatePreview(extracted), {status: 400});
    const legacyRoot = path.join(ctx.dir, 'legacy');
    fs.mkdirSync(path.join(legacyRoot, 'data'), {recursive: true});
    fs.writeFileSync(path.join(legacyRoot, 'data', 'collection.json'), original);
    const legacyArchive = path.join(backupDir, 'legacy.zip');
    const legacyExtracted = path.join(ctx.dir, 'legacy-extracted');
    writeReadableZip(legacyRoot, legacyArchive, password);
    inspectReadableZip(legacyArchive, legacyExtracted, password);
    assert.equal(validatePreview(legacyExtracted, {writeMigrated: true}).bottlings, 1);
    assert.deepEqual(loadCollectionFiles(path.join(legacyExtracted, 'data')).collection, snapshot);
    assert.equal((await api(ctx.base, `/api/external-tastings/${external.id}`, 'DELETE')).status, 200);
    const after = loadCollectionFiles(directory).collection;
    assert.deepEqual(after.externalTastings, []);
    assert.deepEqual(after.tastingFlights[0].tastingIds, [note.id]);
  } finally {await ctx.stop();}
});
