import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startTestServer as start, requestJson as api } from '../helpers/server.js';
test('lifecycle: CRUD, uniqueness, atomic JSON, exports and upload', async () => {
    const ctx = await start();
    const { base, dir } = ctx;
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
        const zip = await fetch(base + '/api/export/zip', { headers: { 'X-Backup-Admin-Token': 'a'.repeat(64) } });
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
            name: 'Falsch zugeordnete Abfüllung', firstBottle: { inventoryNumber: '000047' }
        });
        assert.equal(first.status, 201);
        const firstId = first.data.bottle.id;
        const second = await api(ctx.base, '/api/bottlings', 'POST', {
            name: 'Richtige Abfüllung', firstBottle: { inventoryNumber: '000048' }
        });
        assert.equal(second.status, 201);
        const secondId = second.data.bottle.id;

        // Still in use: assigning the code to another existing bottle fails atomically.
        const occupied = await api(ctx.base, `/api/bottles/${secondId}`, 'PATCH', { inventoryNumber: '000047' });
        assert.equal(occupied.status, 409);
        let current = (await api(ctx.base, '/api/collection')).data;
        assert.equal(current.bottlings[1].bottles[0].inventoryNumber, '000048');

        // Free the historical code by correcting the original bottle's number.
        const corrected = await api(ctx.base, `/api/bottles/${firstId}`, 'PATCH', { inventoryNumber: '000049' });
        assert.equal(corrected.status, 200);
        const reassigned = await api(ctx.base, `/api/bottles/${secondId}`, 'PATCH', { inventoryNumber: '000047' });
        assert.equal(reassigned.status, 200);
        assert.equal(reassigned.data.inventoryNumber, '000047');
        const unchanged = await api(ctx.base, `/api/bottles/${secondId}`, 'PATCH', { inventoryNumber: '000047' });
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
test('migration: old bottling images become photos of first physical bottle', async () => {
    const ctx = await start();
    try {
        const created = await api(ctx.base, '/api/bottlings', 'POST', {
            name: 'Legacy Sample'
        });
        const file = path.join(ctx.dir, 'data/collection.json');
        const db = JSON.parse(fs.readFileSync(file));
        db.bottlings[0].images = {
            bottle: `images/${created.data.bottling.id}/bottle.jpg`, box: null
        };
        delete db.bottlings[0].bottles[0].photos;
        fs.writeFileSync(file, JSON.stringify(db));
        // Re-initialize through a separate server process, as with an application update.
        const { initialize, read } = await import('../../server/storage/collection-store.js');
        // The main process has a separate data directory; verify migration in a child process.
        const migrated = await new Promise((resolve, reject) => {
            const child = spawn(process.execPath, ['--input-type=module', '-e', `import {initialize,read} from './server/storage/collection-store.js';initialize();console.log(JSON.stringify(read().bottlings[0].bottles[0].photos));`], {
                cwd: process.cwd(), env: {
                    ...process.env, WHISKY_DATA_DIR: ctx.dir
                }, stdio: ['ignore', 'pipe', 'pipe']
            });
            let out = '', err = '';
            child.stdout.on('data', x => out += x);
            child.stderr.on('data', x => err += x);
            child.on('close', code => code === 0 ? resolve(JSON.parse(out)) : reject(Error(err)));
        });
        assert.equal(migrated.length, 1);
        assert.equal(migrated[0].legacyType, 'bottle');
        const updated = JSON.parse(fs.readFileSync(file));
        assert.equal(updated.bottlings[0].images, undefined);
    }
    finally {
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
test('migration: existing distilleryId is preserved as distilleryIds without losing photos', async () => {
    const ctx = await start();
    try {
        const ds = (await api(ctx.base, '/api/collection')).data.distilleries[0];
        const old = await api(ctx.base, '/api/bottlings', 'POST', {
            name: 'Old Malt', distilleryId: ds.id
        });
        assert.equal(old.status, 201);
        const file = path.join(ctx.dir, 'data/collection.json');
        const db = JSON.parse(fs.readFileSync(file));
        const b = db.bottlings.find(b => b.id === old.data.bottling.id);
        b.distilleryId = ds.id;
        delete b.distilleryIds;
        fs.writeFileSync(file, JSON.stringify(db));
        const child = spawn(process.execPath, ['--input-type=module', '-e', `import {initialize,read} from './server/storage/collection-store.js';initialize();console.log(JSON.stringify(read().bottlings[0]));`], {
            cwd: process.cwd(), env: {
                ...process.env, WHISKY_DATA_DIR: ctx.dir
            }, stdio: ['ignore', 'pipe', 'pipe']
        });
        const output = await new Promise((resolve, reject) => {
            let out = '', err = '';
            child.stdout.on('data', c => out += c);
            child.stderr.on('data', c => err += c);
            child.on('close', code => code === 0 ? resolve(out) : reject(Error(err)));
        });
        const updated = JSON.parse(output);
        assert.deepEqual(updated.distilleryIds, [ds.id]);
        assert.equal(updated.distilleryId, undefined);
        assert.equal(JSON.parse(fs.readFileSync(file)).bottlings[0].distilleryId, undefined);
    }
    finally {
        await ctx.stop();
    }
});
test('migration: legacy top-level bottles are nested, preserving IDs, photos, and inventory', async () => {
    const ctx = await start();
    try {
        const created = await api(ctx.base, '/api/bottlings', 'POST', {
            name: 'Legacy Bottling', firstBottle: {
                inventoryNumber: '000772', status: 'open'
            }
        });
        assert.equal(created.status, 201);
        const file = path.join(ctx.dir, 'data/collection.json');
        const db = JSON.parse(fs.readFileSync(file));
        const bottle = db.bottlings[0].bottles[0];
        bottle.photos.push({
            id: 'photo-legacy', path: `images/${bottle.id}/photo-legacy.jpg`, createdAt: new Date().toISOString()
        });
        db.schemaVersion = 1;
        db.bottles = [{
                ...bottle, bottlingId: db.bottlings[0].id
            }];
        delete db.bottlings[0].bottles;
        fs.writeFileSync(file, JSON.stringify(db));
        const migrated = await new Promise((resolve, reject) => {
            const child = spawn(process.execPath, ['--input-type=module', '-e', `import {initialize,read} from './server/storage/collection-store.js';initialize();console.log(JSON.stringify(read()));`], {
                cwd: process.cwd(), env: {
                    ...process.env, WHISKY_DATA_DIR: ctx.dir
                }, stdio: ['ignore', 'pipe', 'pipe']
            });
            let out = '', err = '';
            child.stdout.on('data', c => out += c);
            child.stderr.on('data', c => err += c);
            child.on('close', code => code === 0 ? resolve(JSON.parse(out)) : reject(Error(err)));
        });
        assert.equal(migrated.schemaVersion, 4);
        assert.equal(Object.hasOwn(migrated, 'bottles'), false);
        assert.equal(migrated.bottlings[0].bottles.length, 1);
        assert.equal(migrated.bottlings[0].bottles[0].id, bottle.id);
        assert.equal(migrated.bottlings[0].bottles[0].inventoryNumber, '000772');
        assert.equal(migrated.bottlings[0].bottles[0].photos[0].path, bottle.photos[0].path);
        assert.equal(Object.hasOwn(migrated.bottlings[0].bottles[0], 'bottlingId'), false);
        assert.ok(fs.readdirSync(path.join(ctx.dir, 'backups')).some(name => name.startsWith('pre-migration-')));
    }
    finally {
        await ctx.stop();
    }
});
test('import accepts legacy collection and stores only nested bottles', async () => {
    const ctx = await start();
    try {
        const original = (await api(ctx.base, '/api/collection')).data;
        const d = original.distilleries[0];
        const b = {
            id: 'legacy-bottling', name: 'Legacy Import', distilleryId: d.id, createdAt: new Date().toISOString()
        };
        const old = {
            ...original, schemaVersion: 1, bottlings: [b], bottles: [{
                    id: 'legacy-bottle', bottlingId: b.id, inventoryNumber: '000900', labelCode: '', status: 'closed', photos: []
                }], reservedInventoryNumbers: ['000900'], nextInventoryNumber: 901
        };
        const imported = await api(ctx.base, '/api/import/json', 'POST', old);
        assert.equal(imported.status, 200, JSON.stringify(imported.data));
        const after = (await api(ctx.base, '/api/collection')).data;
        assert.equal(after.schemaVersion, 4);
        assert.equal(Object.hasOwn(after, 'bottles'), false);
        assert.equal(after.bottlings[0].bottles[0].id, 'legacy-bottle');
        assert.deepEqual(after.bottlings[0].distilleryIds, [d.id]);
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
            firstBottle: { inventoryNumber: '000700', volumeType: 'standard', status: 'closed' }
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
        assert.equal(db.schemaVersion, 4);
        assert.equal(db.bottlings[0].volumeType, undefined);
        assert.deepEqual(db.bottlings[0].bottles.map(x => x.volumeType), ['standard', 'sample']);
        const csv = await fetch(ctx.base + '/api/export/csv');
        const content = await csv.text();
        assert.match(content, /Flaschentyp/);
        assert.match(content, /"Sample";"50"/);
        assert.match(content, /"Normal";"700"/);
        const invalid = await api(ctx.base, `/api/bottlings/${created.data.bottling.id}`, 'PATCH', { volumeType: 'sample' });
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
        assert.equal(imported.status, 200);
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
        assert.equal(db.schemaVersion, 4);
        assert.equal(db.bottlings[0].bottles[0].inventoryNumber, '000123');
        assert.equal(db.bottlings[0].bottles[0].labelCode, undefined);
    }
    finally {
        await ctx.stop();
    }
});
test('migration: legacy label-only bottle becomes an inventory number, keeping leading zeros', async () => {
    const ctx = await start();
    try {
        const created = await api(ctx.base, '/api/bottlings', 'POST', {
            name: 'Old label'
        });
        const file = path.join(ctx.dir, 'data/collection.json');
        const db = JSON.parse(fs.readFileSync(file));
        db.schemaVersion = 2;
        db.bottlings[0].bottles[0].inventoryNumber = '';
        db.bottlings[0].bottles[0].labelCode = '000077';
        fs.writeFileSync(file, JSON.stringify(db));
        const child = spawn(process.execPath, ['--input-type=module', '-e', "import {initialize,read} from './server/storage/collection-store.js';initialize();console.log(JSON.stringify(read()));"], {
            cwd: process.cwd(), env: {
                ...process.env, WHISKY_DATA_DIR: ctx.dir
            }, stdio: ['ignore', 'pipe', 'pipe']
        });
        const data = await new Promise((resolve, reject) => {
            let stdout = '', stderr = '';
            child.stdout.on('data', d => stdout += d);
            child.stderr.on('data', d => stderr += d);
            child.on('close', code => code === 0 ? resolve(JSON.parse(stdout)) : reject(Error(stderr)));
        });
        assert.equal(data.schemaVersion, 4);
        assert.equal(data.bottlings[0].bottles[0].inventoryNumber, '000077');
        assert.equal(data.bottlings[0].bottles[0].labelCode, undefined);
        assert.ok(data.reservedInventoryNumbers.includes('000077'));
        assert.ok(data.nextInventoryNumber >= 78);
        assert.ok(fs.readdirSync(path.join(ctx.dir, 'backups')).some(n => n.startsWith('pre-migration-')));
    }
    finally {
        await ctx.stop();
    }
});
test('migration: conflicting legacy inventory and label values create an external report', async () => {
    const ctx = await start();
    try {
        await api(ctx.base, '/api/bottlings', 'POST', {
            name: 'Old conflict', firstBottle: {
                inventoryNumber: '000111'
            }
        });
        const file = path.join(ctx.dir, 'data/collection.json');
        const original = JSON.parse(fs.readFileSync(file));
        original.schemaVersion = 2;
        original.bottlings[0].bottles[0].labelCode = '000222';
        fs.writeFileSync(file, JSON.stringify(original));
        const child = spawn(process.execPath, ['--input-type=module', '-e', "import {initialize,read} from './server/storage/collection-store.js';initialize();console.log(JSON.stringify(read().bottlings[0].bottles[0]));"], {
            cwd: process.cwd(), env: {
                ...process.env, WHISKY_DATA_DIR: ctx.dir
            }, stdio: ['ignore', 'pipe', 'pipe']
        });
        const result = await new Promise((resolve, reject) => {
            let stdout = '', stderr = '';
            child.stdout.on('data', d => stdout += d);
            child.stderr.on('data', d => stderr += d);
            child.on('close', code => code === 0 ? resolve({
                bottle: JSON.parse(stdout), stderr
            }) : reject(Error(stderr)));
        });
        assert.equal(result.bottle.inventoryNumber, '000111');
        assert.equal(result.bottle.labelCode, undefined);
        const backupDir = path.join(ctx.dir, 'backups');
        const files = fs.readdirSync(backupDir);
        const report = files.find(n => n.startsWith('inventory-conflicts-'));
        assert.ok(report);
        assert.match(result.stderr, /abweichende alte Etikettencodes/);
        const conflicts = JSON.parse(fs.readFileSync(path.join(backupDir, report)));
        assert.equal(conflicts[0].previousLabelCode, '000222');
        const backup = files.find(n => n.startsWith('pre-migration-'));
        assert.equal(JSON.parse(fs.readFileSync(path.join(backupDir, backup))).bottlings[0].bottles[0].labelCode, '000222');
    }
    finally {
        await ctx.stop();
    }
});
