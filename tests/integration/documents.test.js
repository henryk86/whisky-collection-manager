import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { startTestServer, requestJson } from '../helpers/server.js';

const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
const image = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const dataUrl = (bytes, mime) => `data:${mime};base64,${bytes.toString('base64')}`;

test('files: invoices and additional images belong to physical bottles, survive export and download securely', async () => {
    const ctx = await startTestServer();
    try {
        const created = await requestJson(ctx.base, '/api/bottlings', 'POST', {
            name: 'Insurance archive', firstBottle: { inventoryNumber: '000555', volumeType: 'sample', volumeMl: 30 }
        });
        assert.equal(created.status, 201);
        const { bottle, bottling } = created.data;
        const receipt = await requestJson(ctx.base, `/api/bottles/${bottle.id}/files`, 'POST', {
            filename: 'Rechnung-Österreich.pdf', data: dataUrl(pdf, 'application/pdf')
        });
        assert.equal(receipt.status, 201, JSON.stringify(receipt.data));
        assert.match(receipt.data.path, new RegExp(`^documents/${bottle.id}/[0-9a-f-]+\\.pdf$`));
        assert.equal(receipt.data.name, 'Rechnung-Österreich.pdf');
        assert.equal(receipt.data.sha256, crypto.createHash('sha256').update(pdf).digest('hex'));
        const photoEvidence = await requestJson(ctx.base, `/api/bottles/${bottle.id}/files`, 'POST', {
            filename: 'Siegel.png', data: dataUrl(image, 'image/png')
        });
        assert.equal(photoEvidence.status, 201);
        const sibling = await requestJson(ctx.base, '/api/bottles', 'POST', {
            bottlingId: bottling.id, inventoryNumber: '000556', volumeType: 'standard'
        });
        assert.equal(sibling.status, 201);
        const current = (await requestJson(ctx.base, '/api/collection')).data;
        assert.equal(current.schemaVersion, 4);
        assert.equal(current.bottlings[0].bottles[0].files.length, 2);
        assert.deepEqual(current.bottlings[0].bottles[1].files, []);
        assert.ok(!Object.hasOwn(current.bottlings[0], 'files'));
        assert.equal(current.bottlings[0].bottles[0].volumeType, 'sample');
        const downloaded = await fetch(`${ctx.base}/api/bottles/${bottle.id}/files/${receipt.data.id}`);
        assert.equal(downloaded.status, 200);
        assert.match(downloaded.headers.get('content-disposition'), /filename\*=UTF-8''Rechnung-/);
        assert.equal(downloaded.headers.get('content-type'), 'application/octet-stream');
        assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), pdf);
        assert.equal((await fetch(`${ctx.base}/api/bottles/${sibling.data.id}/files/${receipt.data.id}`)).status, 404);
        assert.equal((await fetch(`${ctx.base}/${receipt.data.path}`)).status, 404, 'documents must not be served by the static file handler');
        const zip = await fetch(`${ctx.base}/api/export/zip`, { headers: { 'X-Backup-Admin-Token': 'a'.repeat(64) } });
        assert.equal(zip.status, 200);
        const bytes = Buffer.from(await zip.arrayBuffer());
        assert.ok(bytes.includes(Buffer.from(receipt.data.path)), 'ZIP must contain receipt path');
        assert.ok(bytes.includes(Buffer.from(photoEvidence.data.path)), 'ZIP must contain evidence photo path');
        assert.equal(bytes.includes(pdf), false, 'ZIP must hide original receipt content');
        assert.ok(fs.existsSync(path.join(ctx.dir, receipt.data.path)));
        const remove = await requestJson(ctx.base, `/api/bottles/${bottle.id}/files/${receipt.data.id}`, 'DELETE');
        assert.equal(remove.status, 200);
        assert.equal(fs.existsSync(path.join(ctx.dir, receipt.data.path)), false);
        assert.equal((await fetch(`${ctx.base}/api/bottles/${bottle.id}/files/${receipt.data.id}`)).status, 404);
        assert.equal((await requestJson(ctx.base, '/api/collection')).data.bottlings[0].bottles[0].files.length, 1);
    } finally { await ctx.stop(); }
});

test('files: reject incompatible formats, forged headers, traversal, and unknown bottle IDs', async () => {
    const ctx = await startTestServer();
    try {
        const created = await requestJson(ctx.base, '/api/bottlings', 'POST', { name: 'Secure uploads' });
        const id = created.data.bottle.id;
        const cases = [
            { filename: '../foo.pdf', data: dataUrl(pdf, 'application/pdf') },
            { filename: 'virus.exe', data: dataUrl(pdf, 'application/pdf') },
            { filename: 'wrong.pdf', data: dataUrl(image, 'application/pdf') },
            { filename: 'invalid.jpg', data: dataUrl(pdf, 'image/jpeg') },
            { filename: 'nonsense.pdf', data: 'not base64' },
            { filename: 'empty.pdf', data: dataUrl(Buffer.alloc(0), 'application/pdf') },
        ];
        for (const item of cases) {
            const response = await requestJson(ctx.base, `/api/bottles/${id}/files`, 'POST', item);
            assert.ok([400, 413].includes(response.status), `${item.filename}: ${JSON.stringify(response)}`);
        }
        const invalid = await requestJson(ctx.base, '/api/bottles/missing/files', 'POST', { filename: 'invoice.pdf', data: dataUrl(pdf, 'application/pdf') });
        assert.equal(invalid.status, 404);
        assert.equal((await requestJson(ctx.base, '/api/collection')).data.bottlings[0].bottles[0].files.length, 0);
    } finally { await ctx.stop(); }
});

test('migration: a v3 sample has type on each bottle after startup without losing nominal size or IDs', async () => {
    const ctx = await startTestServer();
    try {
        const created = await requestJson(ctx.base, '/api/bottlings', 'POST', { name: 'Legacy sample', volumeMl: 20 });
        const f = path.join(ctx.dir, 'data/collection.json');
        const old = JSON.parse(fs.readFileSync(f, 'utf8'));
        old.schemaVersion = 3;
        old.bottlings[0].volumeType = 'sample';
        delete old.bottlings[0].bottles[0].volumeType;
        delete old.bottlings[0].bottles[0].volumeMl;
        const original = JSON.stringify(old);
        const imported = await requestJson(ctx.base, '/api/import/json', 'POST', old);
        assert.equal(imported.status, 200, JSON.stringify(imported));
        const updated = (await requestJson(ctx.base, '/api/collection')).data;
        assert.equal(updated.schemaVersion, 4);
        assert.equal(updated.bottlings[0].volumeType, undefined);
        assert.equal(updated.bottlings[0].volumeMl, 20);
        assert.equal(updated.bottlings[0].bottles[0].volumeType, 'sample');
        assert.equal(updated.bottlings[0].bottles[0].volumeMl, 20);
        assert.equal(updated.bottlings[0].bottles[0].id, created.data.bottle.id);
        assert.deepEqual(updated.bottlings[0].bottles[0].files, []);
        // Restore a true legacy on-disk document and verify initialize() migration
        // without touching data files from the user's real collection.
        fs.writeFileSync(f, original);
        const { spawn } = await import('node:child_process');
        const child = spawn(process.execPath, ['--input-type=module', '-e',
            "import {initialize,read} from './server/storage/collection-store.js';initialize();console.log(JSON.stringify(read().bottlings[0].bottles[0]));"],
            { cwd: process.cwd(), env: { ...process.env, WHISKY_DATA_DIR: ctx.dir }, stdio: ['ignore', 'pipe', 'pipe'] });
        const migrated = await new Promise((resolve, reject) => {
            let stdout = '', stderr = '';
            child.stdout.on('data', x => stdout += x);
            child.stderr.on('data', x => stderr += x);
            child.on('close', code => code === 0 ? resolve(JSON.parse(stdout)) : reject(Error(stderr)));
        });
        assert.equal(migrated.volumeType, 'sample');
        assert.equal(migrated.volumeMl, 20);
        assert.equal(migrated.id, created.data.bottle.id);
        const backups = fs.readdirSync(path.join(ctx.dir, 'backups'));
        const backupName = backups.find(name => name.startsWith('pre-migration-'));
        assert.ok(backupName);
        assert.equal(fs.readFileSync(path.join(ctx.dir, 'backups', backupName), 'utf8'), original);
    } finally { await ctx.stop(); }
});
