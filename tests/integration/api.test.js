import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {startTestServer as start, requestJson as api} from '../helpers/server.js';
test('lifecycle: CRUD, uniqueness, atomic JSON, exports and upload', async () => {
  const ctx = await start();
  const {base, dir} = ctx;
  try {
    const seeded = await api(base, '/api/collection');
    const ardbeg = seeded.data.distilleries.find(x => x.name === 'Ardbeg');
    assert.ok(ardbeg);
    const dist = await api(base, '/api/distilleries', 'POST', {
      name: 'Example Test Distillery'
    });
    assert.equal(dist.status, 201);
    const dupe = await api(base, '/api/distilleries', 'POST', {
      name: 'example test distillery'
    });
    assert.equal(dupe.status, 409);
    const closed = seeded.data.distilleries.find(x => x.name === 'Caperdonich');
    assert.equal(closed?.status, 'closed');
    const reopened = seeded.data.distilleries.find(x => x.name === 'Port Ellen');
    assert.equal(reopened?.status, 'reopened');
    const created = await api(base, '/api/bottlings', 'POST', {
      name: 'Uigeadail', distilleryId: dist.data.id, abv: 54.2, firstBottle: {
        inventoryNumber: '004321', status: 'closed'
      }
    });
    assert.equal(created.status, 201);
    const id = created.data.bottling.id, bottleId = created.data.bottle.id;
    const next = await api(base, '/api/suggest-number');
    assert.equal(next.data.number, '004322');
    const second = await api(base, '/api/bottles', 'POST', {
      bottlingId: id, inventoryNumber: '004322', status: 'open'
    });
    assert.equal(second.status, 201);
    const duplicate = await api(base, '/api/bottles', 'POST', {
      bottlingId: id, inventoryNumber: '004321'
    });
    assert.equal(duplicate.status, 409);
    const patch = await api(base, `/api/bottles/${bottleId}`, 'PATCH', {
      status: 'open', comment: 'Getestet'
    });
    assert.equal(patch.data.status, 'open');
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/fG8AAAAASUVORK5CYII=';
    const upload = await api(base, `/api/bottles/${bottleId}/photos`, 'POST', {
      image: png
    });
    assert.equal(upload.status, 201);
    assert.match(upload.data.path, /^images\//);
    const secondUpload = await api(base, `/api/bottles/${bottleId}/photos`, 'POST', {
      image: png
    });
    assert.equal(secondUpload.status, 201);
    assert.notEqual(upload.data.path, secondUpload.data.path);
    const other = await api(base, `/api/bottles/${second.data.id}/photos`, 'POST', {
      image: png
    });
    assert.equal(other.status, 201);
    const pic = await fetch(base + '/' + upload.data.path);
    assert.equal(pic.status, 200);
    const zip = await fetch(base + '/api/export/zip', {headers: {'X-Backup-Admin-Token': 'a'.repeat(64)}});
    assert.equal(zip.status, 200);
    assert.equal((await zip.arrayBuffer()).byteLength > 100, true);
    const csv = await fetch(base + '/api/export/csv');
    assert.match(await csv.text(), /Uigeadail/);
    const db = JSON.parse(fs.readFileSync(path.join(dir, 'data/collection.json')));
    assert.equal(db.bottlings[0].bottles.length, 2);
    assert.equal(db.bottlings[0].images, undefined);
    assert.equal(db.bottlings[0].bottles[0].photos.length, 2);
    assert.equal(db.bottlings[0].bottles[1].photos.length, 1);
    assert.equal(db.bottlings[0].bottles[0].photos[0].path, upload.data.path);
    const removed = await api(base, `/api/bottles/${bottleId}/photos/${upload.data.id}`, 'DELETE');
    assert.equal(removed.status, 200);
    assert.equal((await fetch(base + '/' + upload.data.path)).status, 404);
    const remaining = await api(base, '/api/collection');
    assert.equal(remaining.data.bottlings[0].bottles[0].photos.length, 1);
    assert.equal(remaining.data.bottlings[0].bottles[1].photos.length, 1);
    const invalidPhoto = await api(base, `/api/bottles/${bottleId}/photos/does-not-exist`, 'DELETE');
    assert.equal(invalidPhoto.status, 404);
    await api(base, `/api/bottles/${bottleId}`, 'DELETE');
    const reuse = await api(base, '/api/bottles', 'POST', {
      bottlingId: id, inventoryNumber: '004321'
    });
    assert.equal(reuse.status, 201, 'historical inventory number can be manually reused once unassigned');
    assert.equal(reuse.data.inventoryNumber, '004321');
    const bad = await fetch(base + '/images/../../server/index.js');
    assert.notEqual(bad.status, 200);
  }
  finally {
    await ctx.stop();
  }
});
test('previously assigned inventory numbers can be manually reused after a correction, but never while occupied', async () => {
  const ctx = await start();
  try {
    const first = await api(ctx.base, '/api/bottlings', 'POST', {
      name: 'Falsch zugeordnete Abfüllung', firstBottle: {inventoryNumber: '000047'}
    });
    assert.equal(first.status, 201);
    const firstId = first.data.bottle.id;
    const second = await api(ctx.base, '/api/bottlings', 'POST', {
      name: 'Richtige Abfüllung', firstBottle: {inventoryNumber: '000048'}
    });
    assert.equal(second.status, 201);
    const secondId = second.data.bottle.id;

    // Still in use: assigning the code to another existing bottle fails atomically.
    const occupied = await api(ctx.base, `/api/bottles/${secondId}`, 'PATCH', {inventoryNumber: '000047'});
    assert.equal(occupied.status, 409);
    let current = (await api(ctx.base, '/api/collection')).data;
    assert.equal(current.bottlings[1].bottles[0].inventoryNumber, '000048');

    // Free the historical code by correcting the original bottle's number.
    const corrected = await api(ctx.base, `/api/bottles/${firstId}`, 'PATCH', {inventoryNumber: '000049'});
    assert.equal(corrected.status, 200);
    const reassigned = await api(ctx.base, `/api/bottles/${secondId}`, 'PATCH', {inventoryNumber: '000047'});
    assert.equal(reassigned.status, 200);
    assert.equal(reassigned.data.inventoryNumber, '000047');
    const unchanged = await api(ctx.base, `/api/bottles/${secondId}`, 'PATCH', {inventoryNumber: '000047'});
    assert.equal(unchanged.status, 200);

    const suggestion = await api(ctx.base, '/api/suggest-number');
    assert.equal(suggestion.data.number, '000050', 'automatic suggestions skip previously assigned numbers');
    current = (await api(ctx.base, '/api/collection')).data;
    assert.deepEqual(current.reservedInventoryNumbers, ['000047', '000048', '000049']);
    assert.deepEqual(current.bottlings.map(b => b.bottles[0].inventoryNumber), ['000049', '000047']);
  } finally {
    await ctx.stop();
  }
});

test('retired HTML import endpoint is unavailable', async () => {
  const ctx = await start();
  try {
    const result = await api(ctx.base, '/api/whiskybase/import', 'POST', {
      url: 'https://www.whiskybase.com/whiskies/whisky/128816/example',
      html: '<h1>Example</h1>'
    });
    assert.equal(result.status, 404);
  } finally {
    await ctx.stop();
  }
});
test('blended malt: multiple constituent distilleries, brand, and CSV export', async () => {
  const ctx = await start();
  try {
    const seeded = (await api(ctx.base, '/api/collection')).data;
    const wanted = ['Ardbeg', 'Bowmore', 'Caol Ila', 'Port Ellen'];
    const ids = wanted.map(name => seeded.distilleries.find(d => d.name === name)?.id);
    assert.equal(ids.filter(Boolean).length, 4, 'Seed muss alle vier Destillerien enthalten');
    const created = await api(ctx.base, '/api/bottlings', 'POST', {
      name: 'Big Peat', brand: 'Big Peat', whiskyType: 'blended_malt', bottler: 'Douglas Laing', distilleryIds: ids, compositionComplete: false, firstBottle: {
        status: 'closed'
      }
    });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    assert.deepEqual(created.data.bottling.distilleryIds, ids);
    assert.equal(created.data.bottling.distilleryId, undefined);
    assert.equal(created.data.bottling.whiskyType, 'blended_malt');
    assert.equal(created.data.bottling.compositionComplete, false);
    const id = created.data.bottling.id;
    const csv = await fetch(ctx.base + '/api/export/csv');
    const content = await csv.text();
    for (const name of wanted) {
      assert.ok(content.includes(name), `CSV missing ${name}`);
    }
    assert.match(content, /blended_malt/);
    assert.match(content, /Douglas Laing/);
    const invalid = await api(ctx.base, `/api/bottlings/${id}`, 'PATCH', {
      whiskyType: 'single_malt'
    });
    assert.equal(invalid.status, 400);
    const valid = await api(ctx.base, `/api/bottlings/${id}`, 'PATCH', {
      distilleryIds: [ids[0]], whiskyType: 'single_malt'
    });
    assert.equal(valid.status, 200);
    assert.deepEqual(valid.data.distilleryIds, [ids[0]]);
    const unknown = await api(ctx.base, `/api/bottlings/${id}`, 'PATCH', {
      distilleryIds: ['does-not-exist']
    });
    assert.equal(unknown.status, 400);
    const missing = await api(ctx.base, '/api/bottlings', 'POST', {
      name: 'Unknown constituents', whiskyType: 'blended_scotch', distilleryIds: []
    });
    assert.equal(missing.status, 201);
  }
  finally {
    await ctx.stop();
  }
});
test('physical bottle type: regular 700 ml and 30 ml sample under the same bottling', async () => {
  const ctx = await start();
  try {
    const created = await api(ctx.base, '/api/bottlings', 'POST', {
      name: 'Mixed release', volumeMl: 700,
      firstBottle: {inventoryNumber: '000700', volumeType: 'standard', status: 'closed'}
    });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    assert.equal(created.data.bottling.volumeType, undefined);
    assert.equal(created.data.bottle.volumeType, 'standard');
    assert.equal(created.data.bottle.volumeMl, 700);
    const sample = await api(ctx.base, '/api/bottles', 'POST', {
      bottlingId: created.data.bottling.id, inventoryNumber: '000701',
      volumeType: 'sample', volumeMl: 30
    });
    assert.equal(sample.status, 201, JSON.stringify(sample.data));
    assert.equal(sample.data.volumeType, 'sample');
    assert.equal(sample.data.volumeMl, 30);
    const changed = await api(ctx.base, `/api/bottles/${sample.data.id}`, 'PATCH', {
      volumeMl: 50
    });
    assert.equal(changed.status, 200);
    assert.equal(changed.data.volumeMl, 50);
    const db = (await api(ctx.base, '/api/collection')).data;
    assert.equal(db.schemaVersion, 6);
    assert.equal(db.bottlings[0].volumeType, undefined);
    assert.deepEqual(db.bottlings[0].bottles.map(x => x.volumeType), ['standard', 'sample']);
    const csv = await fetch(ctx.base + '/api/export/csv');
    const content = await csv.text();
    assert.match(content, /Flaschentyp/);
    assert.match(content, /"Sample";"50"/);
    assert.match(content, /"Normal";"700"/);
    const invalid = await api(ctx.base, `/api/bottlings/${created.data.bottling.id}`, 'PATCH', {volumeType: 'sample'});
    assert.equal(invalid.status, 400, 'bottling may no longer own volumeType');
  }
  finally {
    await ctx.stop();
  }
});
test('legacy labelType is discarded on write and JSON import', async () => {
  const ctx = await start();
  try {
    const created = await api(ctx.base, '/api/bottlings', 'POST', {
      name: 'Label test', firstBottle: {
        inventoryNumber: '000444', labelType: 'qr', status: 'closed'
      }
    });
    assert.equal(created.status, 201);
    assert.ok(!Object.hasOwn(created.data.bottle, 'labelType'));
    assert.ok(!Object.hasOwn(created.data.bottle, 'labelCode'));
    const bottleId = created.data.bottle.id;
    const updated = await api(ctx.base, `/api/bottles/${bottleId}`, 'PATCH', {
      labelType: 'code128', status: 'open'
    });
    assert.equal(updated.status, 200);
    assert.ok(!Object.hasOwn(updated.data, 'labelType'));
    const db = (await api(ctx.base, '/api/collection')).data;
    db.bottlings[0].bottles[0].labelType = 'qr';
    const imported = await api(ctx.base, '/api/import/json', 'POST', db);
    assert.equal(imported.status, 400, 'legacy import fields are no longer silently migrated');
    const after = (await api(ctx.base, '/api/collection')).data;
    assert.ok(!Object.hasOwn(after.bottlings[0].bottles[0], 'labelType'));
    const persisted = JSON.parse(fs.readFileSync(path.join(ctx.dir, 'data/collection.json'), 'utf8'));
    assert.ok(!Object.hasOwn(persisted.bottlings[0].bottles[0], 'labelType'));
    assert.ok(!Object.hasOwn(persisted.bottlings[0].bottles[0], 'labelCode'));
  }
  finally {
    await ctx.stop();
  }
});
test('inventoryNumber is the only label identifier in JSON, API and CSV', async () => {
  const ctx = await start();
  try {
    const created = await api(ctx.base, '/api/bottlings', 'POST', {
      name: 'Only one ID', firstBottle: {
        inventoryNumber: '000123', status: 'closed'
      }
    });
    assert.equal(created.status, 201);
    const id = created.data.bottle.id;
    assert.equal(created.data.bottle.inventoryNumber, '000123');
    assert.ok(!Object.hasOwn(created.data.bottle, 'labelCode'));
    const rejected = await api(ctx.base, `/api/bottles/${id}`, 'PATCH', {
      labelCode: '123456'
    });
    assert.equal(rejected.status, 400);
    const second = await api(ctx.base, '/api/bottles', 'POST', {
      bottlingId: created.data.bottling.id, inventoryNumber: '000123'
    });
    assert.equal(second.status, 409);
    const csv = await fetch(ctx.base + '/api/export/csv');
    const csvText = await csv.text();
    assert.ok(csvText.includes('Inventarnummer'));
    assert.ok(!csvText.includes('Etikettencode'));
    const db = JSON.parse(fs.readFileSync(path.join(ctx.dir, 'data/collection.json')));
    assert.equal(db.schemaVersion, 6);
    assert.equal(db.bottlings[0].bottles[0].inventoryNumber, '000123');
    assert.equal(db.bottlings[0].bottles[0].labelCode, undefined);
  }
  finally {
    await ctx.stop();
  }
});

// A historical database is upgraded in place; only pre-schema-5 tasting content is disposable.
test('schema 4 upgrade retains bottles, inventory, photos, files, distilleries, settings and warehouse assignments', async () => {
  const ctx = await start();
  try {
    const bottling = await api(ctx.base, '/api/bottlings', 'POST', {
      name: 'Whisky mit Bestand', firstBottle: {inventoryNumber: '001234', status: 'open', comment: 'Unbedingt behalten'}
    });
    assert.equal(bottling.status, 201);
    const bottleId = bottling.data.bottle.id;
    const room = (await api(ctx.base, '/api/warehouse/rooms', 'POST', {name: 'Keller', width: 5, height: 4})).data;
    const furniture = (await api(ctx.base, `/api/warehouse/rooms/${room.id}/furniture`, 'POST', {
      name: 'Regal', type: 'regal', x: 0, y: 0, width: 2, depth: 0.6
    })).data;
    const shelf = (await api(ctx.base, `/api/warehouse/furniture/${furniture.id}/shelves`, 'POST', {
      name: 'Oben', capacity: 5
    })).data;
    assert.equal((await api(ctx.base, `/api/warehouse/bottles/${bottleId}`, 'PUT', {shelfId: shelf.id})).status, 200);
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/fG8AAAAASUVORK5CYII=';
    assert.equal((await api(ctx.base, `/api/bottles/${bottleId}/photos`, 'POST', {image: png})).status, 201);
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
    assert.equal((await api(ctx.base, `/api/bottles/${bottleId}/files`, 'POST', {
      filename: 'Originalbeleg.pdf', data: `data:application/pdf;base64,${pdf.toString('base64')}`
    })).status, 201);
    const stored = path.join(ctx.dir, 'data/collection.json');
    const warehouseFile = path.join(ctx.dir, 'data/warehouse.json');
    const warehouseBytes = fs.readFileSync(warehouseFile);
    const before = JSON.parse(fs.readFileSync(stored, 'utf8'));
    before.schemaVersion = 4;
    before.settings = {establishedYear: 2015};
    before.bottlings[0].rating = 82;
    before.bottlings[0].tastingNotes = {nose: 'Old tasting'};
    before.bottlings[0].legacyTastings = [{bottleId, inventoryNumber: '001234', rating: 77}];
    before.bottlings[0].bottles[0].rating = 70;
    before.bottlings[0].tastings = [{id: 'old-demo-tasting'}];
    before.externalTastings = [{id: 'old-external'}];
    before.tastingFlights = [{id: 'old-flight'}];
    const originalBytes = Buffer.from(JSON.stringify(before, null, 2) + '\n');
    fs.writeFileSync(stored, originalBytes);
    const child = spawn(process.execPath, ['--input-type=module', '-e',
      "import {initialize,read} from './server/storage/collection-store.js';import {readWarehouse} from './server/storage/warehouse-store.js';initialize();console.log(JSON.stringify({collection:read(),warehouse:readWarehouse()}));"], {
      cwd: process.cwd(), env: {...process.env, WHISKY_DATA_DIR: ctx.dir}, stdio: ['ignore', 'pipe', 'pipe']
    });
    const upgraded = await new Promise((resolve, reject) => {
      let out = '', err = ''; child.stdout.on('data', c => out += c); child.stderr.on('data', c => err += c);
      child.on('close', code => code === 0 ? resolve(JSON.parse(out)) : reject(Error(err)));
    });
    assert.equal(upgraded.collection.schemaVersion, 6);
    assert.deepEqual(upgraded.collection.distilleries, before.distilleries);
    assert.deepEqual(upgraded.collection.settings, before.settings);
    assert.deepEqual(upgraded.collection.reservedInventoryNumbers, before.reservedInventoryNumbers);
    assert.equal(upgraded.collection.nextInventoryNumber, before.nextInventoryNumber);
    assert.equal(upgraded.collection.bottlings.length, 1);
    const next = upgraded.collection.bottlings[0];
    assert.equal(next.name, before.bottlings[0].name);
    assert.deepEqual(next.bottles[0].photos, before.bottlings[0].bottles[0].photos);
    assert.deepEqual(next.bottles[0].files, before.bottlings[0].bottles[0].files);
    assert.equal(next.bottles[0].files.length, 1);
    assert.equal(next.bottles[0].comment, 'Unbedingt behalten');
    assert.equal(next.bottles[0].inventoryNumber, '001234');
    assert.deepEqual(next.tastings, []);
    assert.equal(next.rating, undefined);
    assert.equal(next.tastingNotes, undefined);
    assert.equal(next.legacyTastings, undefined);
    assert.equal(next.bottles[0].rating, undefined);
    assert.deepEqual(upgraded.collection.externalTastings, []);
    assert.deepEqual(upgraded.collection.tastingFlights, []);
    assert.deepEqual(fs.readFileSync(warehouseFile), warehouseBytes, 'warehouse.json must be byte-for-byte unchanged');
    assert.equal(upgraded.warehouse.assignments[bottleId], shelf.id);
    assert.deepEqual(upgraded.warehouse.rooms[0].furniture[0].shelves[0].id, shelf.id);
    const backups = fs.readdirSync(path.join(ctx.dir, 'backups')).filter(n => n.startsWith('pre-schema6-'));
    assert.equal(backups.length, 1);
    assert.deepEqual(fs.readFileSync(path.join(ctx.dir, 'backups', backups[0])), originalBytes);
    // A second launch MUST NOT create another backup or alter the migrated data.
    const {migrateCollectionToCurrent} = await import('../../server/storage/migrations.js');
    assert.equal(migrateCollectionToCurrent(upgraded.collection).changed, false);
  } finally {await ctx.stop();}
});
test('schema 5 to 6 preserves existing tastings, rating comments, flights, and warehouse data', async () => {
  const ctx = await start();
  try {
    const created = await api(ctx.base, '/api/bottlings', 'POST', {
      name: 'Migration with tasting', firstBottle: {inventoryNumber: '090001'}
    });
    assert.equal(created.status, 201);
    const id = created.data.bottling.id;
    const tasting = await api(ctx.base, `/api/bottlings/${id}/tastings`, 'POST', {
      tastedOn: '2026-11-20', rating: 80, ratingComment: 'Must survive upgrade',
      tastingNotes: {nose: 'Apple', palate: 'Honey', finish: 'Oak'}
    });
    assert.equal(tasting.status, 201);
    const stored = path.join(ctx.dir, 'data/collection.json');
    const warehouse = path.join(ctx.dir, 'data/warehouse.json');
    const warehouseBefore = fs.readFileSync(warehouse);
    const before = JSON.parse(fs.readFileSync(stored, 'utf8'));
    before.schemaVersion = 5;
    const original = Buffer.from(JSON.stringify(before, null, 2) + '\n');
    fs.writeFileSync(stored, original);
    const child = spawn(process.execPath, ['--input-type=module', '-e',
      "import {initialize,read} from './server/storage/collection-store.js';initialize();console.log(JSON.stringify(read()));"], {
      cwd: process.cwd(), env: {...process.env, WHISKY_DATA_DIR: ctx.dir}, stdio: ['ignore', 'pipe', 'pipe']
    });
    const upgraded = await new Promise((resolve, reject) => {
      let out = '', err = ''; child.stdout.on('data', c => out += c); child.stderr.on('data', c => err += c);
      child.on('close', code => code === 0 ? resolve(JSON.parse(out)) : reject(Error(err)));
    });
    assert.equal(upgraded.schemaVersion, 6);
    assert.deepEqual({...upgraded, schemaVersion: 5}, before, 'schema 5 -> 6 must change only the schemaVersion');
    assert.equal(upgraded.bottlings[0].tastings[0].ratingComment, 'Must survive upgrade');
    assert.deepEqual(fs.readFileSync(warehouse), warehouseBefore);
    const backups = fs.readdirSync(path.join(ctx.dir, 'backups')).filter(n => n.startsWith('pre-schema6-'));
    assert.equal(backups.length, 1);
    assert.deepEqual(fs.readFileSync(path.join(ctx.dir, 'backups', backups[0])), original);
    const {migrateCollectionToCurrent} = await import('../../server/storage/migrations.js');
    assert.equal(migrateCollectionToCurrent(upgraded).changed, false);
  } finally {await ctx.stop();}
});

test('schema 5 JSON import retains tasting commentary and upgrades to 6', async () => {
  const ctx = await start();
  try {
    const created = await api(ctx.base, '/api/bottlings', 'POST', {name: 'Imported tasting'});
    assert.equal(created.status, 201);
    const id = created.data.bottling.id;
    const tasting = await api(ctx.base, `/api/bottlings/${id}/tastings`, 'POST', {
      tastedOn: '2026-11-22', rating: 82, ratingComment: 'Ein klarer Gesamteindruck',
      tastingNotes: {nose: 'Honig', palate: 'Karamell', finish: 'Lang'}
    });
    assert.equal(tasting.status, 201);
    const current = (await api(ctx.base, '/api/collection')).data;
    const older = {...current, schemaVersion: 5};
    const imported = await api(ctx.base, '/api/import/json', 'POST', older);
    assert.equal(imported.status, 200);
    const after = (await api(ctx.base, '/api/collection')).data;
    assert.equal(after.schemaVersion, 6);
    assert.deepEqual({...after, schemaVersion: 5}, older, 'import changes only the schema version');
    assert.equal(after.bottlings.find(item => item.id === id).tastings[0].ratingComment,
      'Ein klarer Gesamteindruck');
  } finally {await ctx.stop();}
});

test('invalid schema upgrade leaves entire collection and warehouse untouched', async () => {
  const ctx = await start();
  try {
    const stored = path.join(ctx.dir, 'data/collection.json'), warehouse = path.join(ctx.dir, 'data/warehouse.json');
    const old = JSON.parse(fs.readFileSync(stored, 'utf8'));
    old.schemaVersion = 4;
    old.bottlings = [{id: 'duplicate', name: 'One', distilleryIds: [], bottles: []},
    {id: 'duplicate', name: 'Two', distilleryIds: [], bottles: []}];
    const bytes = Buffer.from(JSON.stringify(old));
    fs.writeFileSync(stored, bytes);
    const warehouseBefore = fs.readFileSync(warehouse);
    const child = spawn(process.execPath, ['--input-type=module', '-e',
      "import {initialize} from './server/storage/collection-store.js';initialize();"], {
      cwd: process.cwd(), env: {...process.env, WHISKY_DATA_DIR: ctx.dir}, stdio: ['ignore', 'pipe', 'pipe']
    });
    const code = await new Promise(resolve => child.on('close', resolve));
    assert.notEqual(code, 0);
    assert.deepEqual(fs.readFileSync(stored), bytes);
    assert.deepEqual(fs.readFileSync(warehouse), warehouseBefore);
    assert.equal(fs.readdirSync(path.join(ctx.dir, 'backups')).filter(n => n.startsWith('pre-schema6-')).length, 0);
  } finally {await ctx.stop();}
});
test('JSON import upgrades old schema without retaining old tastings and rejects stale summary fields in schema 6', async () => {
  const ctx = await start();
  try {
    const current = (await api(ctx.base, '/api/collection')).data;
    assert.equal((await api(ctx.base, '/api/import/json', 'POST', {...current, schemaVersion: 4})).status, 200);
    const created = await api(ctx.base, '/api/bottlings', 'POST', {name: 'New', firstBottle: {inventoryNumber: '000001'}});
    assert.equal(created.status, 201);
    const after = (await api(ctx.base, '/api/collection')).data;
    after.bottlings[0].rating = 91;
    assert.equal((await api(ctx.base, '/api/import/json', 'POST', after)).status, 400);
  } finally {await ctx.stop();}
});
