import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {startTestServer, requestJson as api} from '../helpers/server.js';
import {removeSeparateCollectionFiles} from '../helpers/fixtures.js';
import {loadCollectionFiles, serializeCollectionFiles} from '../../server/storage/collection-files.js';
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
    for (const key of ['settings', 'externalTastings', 'tastingFlights', 'distilleries']) {
      assert.equal(Object.hasOwn(stored, key), false);
      assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, `${key}.json`))), {schemaVersion: key === 'externalTastings' ? 2 : 1, [key]: snapshot[key]});
    }
    const backupDir = path.join(ctx.dir, 'backups');
    const backups = fs.readdirSync(backupDir).filter(name => name.startsWith('pre-schema10-'));
    assert.equal(backups.length, 1);
    assert.deepEqual(fs.readFileSync(path.join(backupDir, backups[0])), original);
    assert.equal(spawnSync(process.execPath, args, options).status, 0);
    assert.deepEqual(fs.readdirSync(backupDir).filter(name => name.startsWith('pre-schema10-')), backups);
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


test('schema 8 split storage and unfinished schema 8 journal migrate losslessly to schema 10', async () => {
  const ctx = await startTestServer();
  try {
    const directory = path.join(ctx.dir, 'data');
    const snapshot = (await api(ctx.base, '/api/collection')).data;
    const chosen = snapshot.distilleries[0];
    assert.ok(chosen);
    const updated = {...snapshot, settings: {establishedYear: 1988}};
    const oldFiles = serializeCollectionFiles(snapshot, 8);
    removeSeparateCollectionFiles(directory);
    for (const [name, content] of Object.entries(oldFiles)) fs.writeFileSync(path.join(directory, name), content);
    fs.writeFileSync(path.join(directory, '.collection-transaction.json'), JSON.stringify({version: 1, collection: {...updated, schemaVersion: 8}}));
    const args = ['--input-type=module', '-e', "import {initialize} from './server/storage/collection-store.js';initialize();"];
    const result = spawnSync(process.execPath, args, {env: {...process.env, WHISKY_DATA_DIR: ctx.dir}, encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(loadCollectionFiles(directory).collection, updated);
    const backupDir = path.join(ctx.dir, 'backups');
    const backups = fs.readdirSync(backupDir).filter(name => name.startsWith('pre-schema10-'));
    assert.equal(backups.length, 1);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(backupDir, backups[0]))), {...updated, schemaVersion: 8});
    assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(path.join(directory, 'collection.json'))), 'distilleries'), false);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, 'distilleries.json'))), {schemaVersion: 1, distilleries: updated.distilleries});
    const legacyRoot = path.join(ctx.dir, 'legacy8');
    fs.mkdirSync(path.join(legacyRoot, 'data'), {recursive: true});
    for (const [name, content] of Object.entries(serializeCollectionFiles(updated, 8))) fs.writeFileSync(path.join(legacyRoot, 'data', name), content);
    const archive = path.join(backupDir, 'legacy8.zip');
    const extracted = path.join(ctx.dir, 'legacy8-extracted');
    const password = 'test-passphrase-123456';
    writeReadableZip(legacyRoot, archive, password);
    inspectReadableZip(archive, extracted, password);
    validatePreview(extracted, {writeMigrated: true});
    assert.deepEqual(loadCollectionFiles(path.join(extracted, 'data')).collection, updated);
    fs.unlinkSync(path.join(extracted, 'data', 'distilleries.json'));
    assert.throws(() => validatePreview(extracted), {status: 400});
  } finally {await ctx.stop();}
});

test('schema 9 migration, subtitle persistence and ZIP restore preserve release identities', async () => {
  const ctx = await startTestServer();
  try {
    const directory = path.join(ctx.dir, 'data');
    const created = await api(ctx.base, '/api/bottlings', 'POST', {name: 'Kilchoman Genesis', brand: 'Genesis', firstBottle: {status: 'closed'}});
    assert.equal(created.status, 201);
    const id = created.data.bottling.id;
    const external = await api(ctx.base, '/api/external-tastings', 'POST', {bottling: {name: 'Kilchoman Genesis'}, tastedOn: day});
    assert.equal(external.status, 201);
    const snapshot = (await api(ctx.base, '/api/collection')).data;
    for (const [name, content] of Object.entries(serializeCollectionFiles(snapshot, 9))) fs.writeFileSync(path.join(directory, name), content);
    fs.writeFileSync(path.join(directory, '.collection-transaction.json'), JSON.stringify({version: 1, collection: {...snapshot, schemaVersion: 9}}));
    const args = ['--input-type=module', '-e', "import {initialize} from './server/storage/collection-store.js';initialize();"];
    const options = {env: {...process.env, WHISKY_DATA_DIR: ctx.dir}, encoding: 'utf8'};
    const result = spawnSync(process.execPath, args, options);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(loadCollectionFiles(directory).collection, snapshot);
    const backupDir = path.join(ctx.dir, 'backups');
    const backups = fs.readdirSync(backupDir).filter(name => name.startsWith('pre-schema10-'));
    assert.equal(backups.length, 1);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(backupDir, backups[0]))), {...snapshot, schemaVersion: 9});
    assert.equal(spawnSync(process.execPath, args, options).status, 0);
    assert.deepEqual(fs.readdirSync(backupDir).filter(name => name.startsWith('pre-schema10-')), backups);
    const ownedPath = `/api/bottlings/${id}`;
    const externalPath = `/api/external-tastings/${external.data.id}`;
    const subtitle = 'Fermenting – Stage 5';
    const updated = await api(ctx.base, ownedPath, 'PATCH', {subtitle: ` ${subtitle} `});
    assert.equal(updated.status, 200);
    assert.equal(updated.data.subtitle, subtitle);
    assert.equal(updated.data.name, 'Kilchoman Genesis');
    assert.equal(updated.data.brand, 'Genesis');
    assert.equal((await api(ctx.base, ownedPath, 'PATCH', {subtitle: 5})).status, 400);
    assert.equal((await api(ctx.base, ownedPath, 'PATCH', {subtitle: 'a'.repeat(181)})).status, 400);
    assert.equal((await api(ctx.base, ownedPath, 'PATCH', {abv: 46})).data.subtitle, subtitle);
    assert.equal((await api(ctx.base, externalPath, 'PATCH', {bottling: {subtitle}})).data.bottling.subtitle, subtitle);
    assert.equal((await api(ctx.base, externalPath, 'PATCH', {bottling: {subtitle: 5}})).status, 400);
    const saved = loadCollectionFiles(directory).collection;
    assert.equal(saved.bottlings[0].subtitle, subtitle);
    assert.equal(saved.externalTastings[0].bottling.subtitle, subtitle);
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'externalTastings.json'))).schemaVersion, 2);
    const csv = await fetch(ctx.base + '/api/export/csv');
    assert.match(await csv.text(), /Fermenting – Stage 5/);
    const archive = path.join(backupDir, 'subtitle.zip');
    const extracted = path.join(ctx.dir, 'subtitle-extracted');
    const password = 'test-passphrase-123456';
    writeReadableZip(ctx.dir, archive, password);
    inspectReadableZip(archive, extracted, password);
    validatePreview(extracted, {writeMigrated: true});
    assert.deepEqual(loadCollectionFiles(path.join(extracted, 'data')).collection, saved);
    assert.equal((await api(ctx.base, ownedPath, 'PATCH', {subtitle: null})).data.subtitle, null);
    assert.equal((await api(ctx.base, externalPath, 'PATCH', {bottling: {subtitle: ''}})).data.bottling.subtitle, '');
  } finally {await ctx.stop();}
});
