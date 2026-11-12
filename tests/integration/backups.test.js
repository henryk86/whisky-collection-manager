import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { startTestServer } from '../helpers/server.js';

const token = 'a'.repeat(64), workerToken = 'b'.repeat(64);
const zipPass = 'SicheresTestpasswort-2026-mindestens-14!';
const validProfile = { name: 'USB tagsüber', format: 'zip', provider: 'local', targetPath: 'usb/sammlung', enabled: true,
    schedule: { frequency: 'daily', hour: 3, minute: 15, weekday: 1 },
    retention: { daily: 7, weekly: 4, monthly: 12 } };
async function request(base, endpoint, method = 'GET', body, auth = token) {
    const response = await fetch(base + endpoint, { method,
        headers: { 'X-Backup-Admin-Token': auth, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: await response.json() };
}
async function fixture({ withTargets = false } = {}) {
    const control = fs.mkdtempSync(path.join(os.tmpdir(), 'whisky-backup-test-'));
    const env = Object.fromEntries(['BACKUP_ADMIN_TOKEN', 'BACKUP_WORKER_TOKEN', 'BACKUP_CONTROL_DIR', 'BACKUP_TARGET_ROOT'].map(name => [name, process.env[name]]));
    process.env.BACKUP_ADMIN_TOKEN = token;
    process.env.BACKUP_WORKER_TOKEN = workerToken;
    process.env.BACKUP_CONTROL_DIR = control;
    if (withTargets) process.env.BACKUP_TARGET_ROOT = path.join(control, 'targets');
    const server = await startTestServer();
    for (const [k, v] of Object.entries(env)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    return { ...server, control, stop: async () => { await server.stop(); fs.rmSync(control, { recursive: true, force: true }); } };
}
test('backup password is admin-only, persistent, never returned, and required for new ZIPs', async () => {
    const ctx = await fixture();
    try {
        const passwordFile = path.join(ctx.control, 'backup-zip-password');
        fs.unlinkSync(passwordFile);
        assert.equal((await request(ctx.base, '/api/backups')).data.passwordConfigured, false);
        assert.equal((await fetch(ctx.base + '/api/export/zip', { headers: { 'X-Backup-Admin-Token': token } })).status, 409);
        const denied = await request(ctx.base, '/api/backups/password', 'POST', { password: zipPass, confirm: zipPass }, 'bad');
        assert.equal(denied.status, 401);
        assert.equal(fs.existsSync(passwordFile), false);
        assert.equal((await request(ctx.base, '/api/backups/password', 'POST', { password: 'short', confirm: 'short' })).status, 400);
        assert.equal((await request(ctx.base, '/api/backups/password', 'POST', { password: zipPass, confirm: zipPass })).status, 200);
        assert.equal(fs.readFileSync(passwordFile, 'utf8').trim(), zipPass);
        const dashboard = await request(ctx.base, '/api/backups');
        assert.equal(dashboard.data.passwordConfigured, true);
        assert.equal(JSON.stringify(dashboard.data).includes(zipPass), false);
        assert.equal((await request(ctx.base, '/api/backups/password', 'POST', {
            password: 'NeuesBackupPasswort-weitere-2026', confirm: 'NeuesBackupPasswort-weitere-2026', previous: 'incorrect'
        })).status, 400);
        assert.equal(fs.readFileSync(passwordFile, 'utf8').trim(), zipPass);
        assert.equal((await request(ctx.base, '/api/backups/password', 'POST', {
            password: 'NeuesBackupPasswort-weitere-2026', confirm: 'NeuesBackupPasswort-weitere-2026', previous: zipPass
        })).status, 200);
        const response = await fetch(ctx.base + '/api/export/zip', { headers: { 'X-Backup-Admin-Token': token } });
        assert.equal(response.status, 200);
        const archive = path.join(ctx.control, 'password-test.zip');
        fs.writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
        const { inspectReadableZip } = await import('../../shared/backup-zip.js');
        assert.throws(() => inspectReadableZip(archive, null, zipPass), /Passwort/);
        assert.equal(inspectReadableZip(archive, null, 'NeuesBackupPasswort-weitere-2026').encrypted, true);
    } finally { await ctx.stop(); }
});

test('backup admin API requires separate key and manages 1-n schedules without touching collection.json', async () => {
    const ctx = await fixture();
    try {
        assert.equal((await request(ctx.base, '/api/backups', 'GET', null, '')).status, 401);
        assert.equal((await request(ctx.base, '/api/backups', 'GET', null, 'wrong')).status, 401);
        const original = fs.readFileSync(path.join(ctx.dir, 'data/collection.json'));
        const first = await request(ctx.base, '/api/backups', 'POST', validProfile);
        assert.equal(first.status, 201);
        assert.match(first.data.id, /^[0-9a-f-]{36}$/i);
        const second = await request(ctx.base, '/api/backups', 'POST', { ...validProfile, name: 'Dropbox', provider: 'dropbox', remote: 'cloud', targetPath: 'whisky' });
        assert.equal(second.status, 201);
        const duplicateRepo = await request(ctx.base, '/api/backups', 'POST', { ...validProfile, name: 'Gleicher USB-Ordner' });
        assert.equal(duplicateRepo.status, 409);
        const duplicateRemote = await request(ctx.base, '/api/backups', 'POST', { ...validProfile, name: 'Gleiche Cloud', provider: 'onedrive', remote: 'cloud', targetPath: 'whisky' });
        assert.equal(duplicateRemote.status, 409);
        const newZip = await request(ctx.base, '/api/backups', 'POST', { ...validProfile, format: undefined, name: 'ZIP einfach', targetPath: 'usb/whisky-zip' });
        assert.equal(newZip.status, 201);
        assert.equal(newZip.data.format, 'zip', 'new profiles default to readable ZIP');
        const dash = await request(ctx.base, '/api/backups');
        assert.equal(dash.data.profiles.length, 3);
        assert.equal(dash.data.worker.online, false);
        assert.deepEqual(fs.readFileSync(path.join(ctx.dir, 'data/collection.json')), original);
        const updated = await request(ctx.base, `/api/backups/${first.data.id}`, 'PUT', { ...validProfile, enabled: false });
        assert.equal(updated.data.enabled, false);
        const bad = await request(ctx.base, '/api/backups', 'POST', { ...validProfile, targetPath: '../escape' });
        assert.equal(bad.status, 400);
        const run = await request(ctx.base, `/api/backups/${first.data.id}/run`, 'POST', {});
        assert.equal(run.status, 202);
        assert.equal(fs.existsSync(path.join(ctx.control, 'jobs', `${run.data.id}.json`)), true);
        const invalidRestore = await request(ctx.base, `/api/backups/${first.data.id}/prepare`, 'POST', { snapshotId: '../../secret' });
        assert.equal(invalidRestore.status, 400);
        const restore = await request(ctx.base, `/api/backups/${first.data.id}/prepare`, 'POST', { snapshotId: 'latest' });
        assert.equal(restore.status, 202);
        const deleted = await request(ctx.base, `/api/backups/${second.data.id}`, 'DELETE');
        assert.equal(deleted.data.repositoryDeleted, false);
        assert.equal((await request(ctx.base, '/api/backups')).data.profiles.length, 2);
    } finally { await ctx.stop(); }
});
test('worker-only endpoint produces consistent data, image and document directories', async () => {
    const ctx = await fixture();
    try {
        const photo = path.join(ctx.dir, 'images', 'test.jpg');
        const document = path.join(ctx.dir, 'documents', 'invoice.pdf');
        fs.mkdirSync(path.dirname(photo), { recursive: true });
        fs.mkdirSync(path.dirname(document), { recursive: true });
        fs.writeFileSync(photo, 'picture'); fs.writeFileSync(document, 'receipt');
        const id = crypto.randomUUID();
        const endpoint = `/internal/backup/snapshot/${id}`;
        const denied = await fetch(ctx.base + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        assert.equal(denied.status, 403);
        const res = await fetch(ctx.base + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Backup-Worker-Token': workerToken }, body: '{}' });
        assert.equal(res.status, 200);
        const folder = path.join(ctx.control, 'staging', id);
        assert.equal(fs.readFileSync(path.join(folder, 'images', 'test.jpg'), 'utf8'), 'picture');
        assert.equal(fs.readFileSync(path.join(folder, 'documents', 'invoice.pdf'), 'utf8'), 'receipt');
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(folder, 'data', 'collection.json'))), JSON.parse(fs.readFileSync(path.join(ctx.dir, 'data', 'collection.json'))));
        const duplicate = await fetch(ctx.base + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Backup-Worker-Token': workerToken }, body: '{}' });
        assert.equal(duplicate.status, 200);
        assert.equal((await duplicate.json()).created, false);
    } finally { await ctx.stop(); }
});

test('browser can download an existing readable USB ZIP with admin key; USB target is discovered', async () => {
    const ctx = await fixture({ withTargets: true });
    try {
        const targetRoot = path.join(ctx.control, 'targets');
        const target = path.join(targetRoot, 'usb', 'whisky-zip');
        fs.mkdirSync(target, { recursive: true });
        fs.writeFileSync(path.join(targetRoot, 'usb', '.whisky-backup-target'), 'mounted');
        const input = { ...validProfile, format: 'zip', name: 'USB ZIP', targetPath: 'usb/whisky-zip' };
        const profile = await request(ctx.base, '/api/backups', 'POST', input);
        assert.equal(profile.status, 201);
        const filename = 'whisky-backup-2026-11-07T12-00-00-000-12345678.zip';
        fs.writeFileSync(path.join(target, filename), Buffer.from('dummy-zip-for-stream-test'));
        const dashboard = await request(ctx.base, '/api/backups');
        assert.deepEqual(dashboard.data.targets, [{ name: 'usb', label: 'USB-Stick' }]);
        const url = `${ctx.base}/api/backups/${profile.data.id}/files/${filename}`;
        assert.equal((await fetch(url)).status, 401);
        const downloaded = await fetch(url, { headers: { 'X-Backup-Admin-Token': token } });
        assert.equal(downloaded.status, 200);
        assert.match(downloaded.headers.get('content-disposition'), /attachment/);
        assert.equal(downloaded.headers.get('content-type'), 'application/zip');
        assert.equal(Buffer.from(await downloaded.arrayBuffer()).toString(), 'dummy-zip-for-stream-test');
        assert.equal((await fetch(`${ctx.base}/api/backups/${profile.data.id}/files/not-valid.zip`, {
            headers: { 'X-Backup-Admin-Token': token } })).status, 404);
    } finally {
        await ctx.stop();
    }
});

test('ZIP restore is previewed before confirmation and saves the current collection before replacement', async () => {
    const ctx = await fixture();
    try {
        const { writeReadableZip, inspectReadableZip } = await import('../../shared/backup-zip.js');
        fs.mkdirSync(path.join(ctx.dir, 'images'), { recursive: true });
        fs.mkdirSync(path.join(ctx.dir, 'documents'), { recursive: true });
        fs.writeFileSync(path.join(ctx.dir, 'images', 'existing.png'), Buffer.from([1, 2, 3]));
        const original = JSON.parse(fs.readFileSync(path.join(ctx.dir, 'data/collection.json'), 'utf8'));
        const archive = path.join(ctx.control, 'my-backup.zip');
        writeReadableZip(ctx.dir, archive, zipPass);
        const added = await request(ctx.base, '/api/bottlings', 'POST', { name: 'Only in current collection' }, '');
        // Above API isn't admin-gated; request helper sends the extra header harmlessly.
        assert.equal(added.status, 201);
        assert.equal((await request(ctx.base, '/api/collection')).data.bottlings.length, 1);
        const uploadUrl = `${ctx.base}/api/backups/import-zip`;
        assert.equal((await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': 'application/zip' }, body: fs.readFileSync(archive) })).status, 401);
        const badPassword = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': 'application/zip', 'X-Backup-Admin-Token': token, 'X-Backup-Zip-Password': 'wrong-password' }, body: fs.readFileSync(archive) });
        assert.equal(badPassword.status, 400);
        const uploaded = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': 'application/zip', 'X-Backup-Admin-Token': token, 'X-Backup-Zip-Password': encodeURIComponent(zipPass) }, body: fs.readFileSync(archive) });
        assert.equal(uploaded.status, 201, await uploaded.clone().text());
        const preview = await uploaded.json();
        assert.equal(preview.bottlings, 0);
        assert.equal((await request(ctx.base, '/api/collection')).data.bottlings.length, 1, 'preview must not replace live data');
        const endpoint = `/api/backups/import-zip/${preview.id}/apply`;
        const denied = await request(ctx.base, endpoint, 'POST', { acknowledge: false });
        assert.equal(denied.status, 400);
        const wrongApply = await request(ctx.base, endpoint, 'POST', { acknowledge: true, password: 'wrong' });
        assert.equal(wrongApply.status, 400);
        const applied = await request(ctx.base, endpoint, 'POST', { acknowledge: true, password: zipPass });
        assert.equal(applied.status, 200, JSON.stringify(applied.data));
        const restored = (await request(ctx.base, '/api/collection')).data;
        assert.deepEqual(restored, original);
        assert.equal(fs.readFileSync(path.join(ctx.dir, 'images', 'existing.png')).length, 3);
        const safety = path.join(ctx.dir, applied.data.safetyBackup);
        assert.equal(inspectReadableZip(safety, null, zipPass).files >= 3, true);
        const oldCollection = path.join(ctx.control, 'old-collection');
        inspectReadableZip(safety, oldCollection, zipPass);
        assert.equal(JSON.parse(fs.readFileSync(path.join(oldCollection, 'data/collection.json'), 'utf8')).bottlings.length, 1);
    } finally { await ctx.stop(); }
});


test('manual full ZIP download uses shared backup archive and can be inspected with the restore reader', async () => {
    const ctx = await fixture();
    try {
        const img = path.join(ctx.dir, 'images', 'manual-photo.png');
        const doc = path.join(ctx.dir, 'documents', 'manual-invoice.pdf');
        fs.mkdirSync(path.dirname(img), { recursive: true });
        fs.mkdirSync(path.dirname(doc), { recursive: true });
        fs.writeFileSync(img, Buffer.from([1, 2, 3, 255]));
        fs.writeFileSync(doc, 'evidence');
        const response = await fetch(ctx.base + '/api/export/zip', { headers: { 'X-Backup-Admin-Token': token } });
        assert.equal(response.status, 200, await response.clone().text().then(s => s.slice(0, 150)));
        assert.match(response.headers.get('content-disposition'), /attachment/);
        const content = Buffer.from(await response.arrayBuffer());
        const archive = path.join(ctx.control, 'manual.zip');
        fs.writeFileSync(archive, content);
        const { inspectReadableZip } = await import('../../shared/backup-zip.js');
        const restored = path.join(ctx.control, 'inspect');
        inspectReadableZip(archive, restored, zipPass);
        assert.deepEqual(fs.readFileSync(path.join(restored, 'images', 'manual-photo.png')), Buffer.from([1, 2, 3, 255]));
        assert.equal(fs.readFileSync(path.join(restored, 'documents', 'manual-invoice.pdf'), 'utf8'), 'evidence');
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(restored, 'data/collection.json'))),
            JSON.parse(fs.readFileSync(path.join(ctx.dir, 'data/collection.json'))));
        // The client may finish receiving the last byte just before the server's
        // streaming pipeline resolves and removes its temporary file.
        let pending = 1;
        for (let attempt = 0; attempt < 40; attempt++) {
            pending = fs.readdirSync(path.join(ctx.dir, 'backups')).filter(name => name.startsWith('.download-')).length;
            if (!pending) break;
            await new Promise(resolve => setTimeout(resolve, 25));
        }
        assert.equal(pending, 0, 'temporary download file should be removed after streaming');
    } finally { await ctx.stop(); }
});
