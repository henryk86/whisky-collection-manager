import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import crypto from 'node:crypto';
import { writeReadableZip, inspectReadableZip } from '../../shared/backup-zip.js';

const zipPass = 'SicheresTestpasswort-2026-mindestens-14!';
const create = (dir, relative, text) => {
    const full = path.join(dir, relative);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text, { mode: 0o600 });
    return full;
};
test('AES-256 ZIP encrypts collection, images, documents; HMAC detects damaged archives', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whisky-readable-zip-'));
    try {
        const source = path.join(root, 'source');
        create(source, 'data/collection.json', JSON.stringify({ schemaVersion: 4 }));
        create(source, 'images/subfolder/photo.jpg', Buffer.from([0, 1, 2, 3, 255]));
        create(source, 'documents/rechnung.pdf', '%PDF-1.4 test');
        const archive = path.join(root, 'backup.zip');
        const result = writeReadableZip(source, archive, zipPass, '2026-11-07T14:00:00.000Z');
        assert.equal(result.files, 4);
        assert.throws(() => inspectReadableZip(archive), /Passwort/);
        assert.throws(() => inspectReadableZip(archive, null, 'falsch'), /Passwort/);
        assert.equal(inspectReadableZip(archive, null, zipPass).files, 4);
        assert.equal(fs.readFileSync(archive).includes(Buffer.from('\"schemaVersion\":4')), false);
        const extract = path.join(root, 'extracted');
        inspectReadableZip(archive, extract, zipPass);
        assert.equal(fs.readFileSync(path.join(extract, 'data/collection.json'), 'utf8'), '{"schemaVersion":4}');
        assert.deepEqual(fs.readFileSync(path.join(extract, 'images/subfolder/photo.jpg')), Buffer.from([0, 1, 2, 3, 255]));
        assert.equal(fs.readFileSync(path.join(extract, 'documents/rechnung.pdf'), 'utf8'), '%PDF-1.4 test');
        // Tamper with README ciphertext; AES authentication must reject it.
        const data = fs.readFileSync(archive);
        const changed = Buffer.from(data);
        changed[30 + Buffer.byteLength('README.txt') + 11 + 18] ^= 1;
        fs.writeFileSync(archive, changed);
        assert.throws(() => inspectReadableZip(archive, null, zipPass), /Authentifizierung/);
        assert.throws(() => inspectReadableZip(archive, path.join(root, 'failed'), zipPass), /Authentifizierung/);
        assert.equal(fs.existsSync(path.join(root, 'failed')), false, 'failed extraction must clean up');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('ZIP backup worker writes portable archives, prunes old runs and restores without changing live data', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whisky-zip-worker-'));
    const control = path.join(root, 'control'), targets = path.join(root, 'targets');
    const token = 'a'.repeat(64), profileId = crypto.randomUUID();
    const profile = { id: profileId, name: 'USB ZIP', provider: 'local', format: 'zip', remote: '',
        targetPath: 'usb/whisky-zip', enabled: false, schedule: { frequency: 'daily', hour: 2, minute: 0, weekday: 0 },
        retention: { daily: 1, weekly: 0, monthly: 0 } };
    create(targets, 'usb/.whisky-backup-target', 'test');
    create(control, 'backup-zip-password', zipPass);
    create(control, 'profiles.json', JSON.stringify({ version: 1, profiles: [profile] }));
    create(root, 'worker-token', token);
    const original = Object.fromEntries(['BACKUP_CONTROL_DIR', 'BACKUP_TARGET_ROOT', 'BACKUP_WORKER_TOKEN_FILE', 'APP_INTERNAL_URL'].map(key => [key, process.env[key]]));
    let server;
    try {
        server = http.createServer((req, res) => {
            if (req.headers['x-backup-worker-token'] !== token || req.method !== 'POST') {
                res.writeHead(403); return res.end('{}');
            }
            const id = req.url.split('/').at(-1);
            create(control, `staging/${id}/data/collection.json`, '{"schemaVersion":4}');
            create(control, `staging/${id}/images/pic.png`, 'photo');
            create(control, `staging/${id}/documents/bill.pdf`, 'invoice');
            res.setHeader('Content-Type', 'application/json'); res.end('{}');
        });
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        Object.assign(process.env, { BACKUP_CONTROL_DIR: control, BACKUP_TARGET_ROOT: targets,
            BACKUP_WORKER_TOKEN_FILE: path.join(root, 'worker-token'),
            APP_INTERNAL_URL: `http://127.0.0.1:${server.address().port}` });
        const { createWorker } = await import('../../worker/backup-worker.js?zip-integration');
        const worker = createWorker();
        const queue = (type, extras = {}) => {
            const id = crypto.randomUUID();
            create(control, `jobs/${id}.json`, JSON.stringify({ id, profileId, type, createdAt: new Date().toISOString(), ...extras }));
            return id;
        };
        const first = queue('run');
        await worker.processQueue();
        assert.equal(worker.getStatus().jobs.find(j => j.id === first).state, 'success');
        let archives = fs.readdirSync(path.join(targets, 'usb/whisky-zip')).filter(f => f.endsWith('.zip'));
        assert.equal(archives.length, 1);
        assert.equal(inspectReadableZip(path.join(targets, 'usb/whisky-zip', archives[0]), null, zipPass).files, 4);
        const second = queue('run');
        await worker.processQueue();
        archives = fs.readdirSync(path.join(targets, 'usb/whisky-zip')).filter(f => f.endsWith('.zip'));
        assert.equal(archives.length, 1, 'retention keeps only one per day');
        const verify = queue('check');
        const list = queue('snapshots');
        const restore = queue('prepare', { snapshotId: 'latest' });
        await worker.processQueue();
        assert.equal(worker.getStatus().jobs.find(j => j.id === verify).state, 'success');
        assert.equal(worker.getStatus().jobs.find(j => j.id === list).state, 'success');
        assert.equal(worker.getStatus().jobs.find(j => j.id === restore).state, 'success');
        assert.equal(inspectReadableZip(path.join(control, 'imports', restore, 'uploaded.zip'), null, zipPass).files, 4);
        const prepared = queue('prepare', { snapshotId: 'latest' });
        await worker.processQueue();
        const ready = worker.getStatus().jobs.find(j => j.id === prepared);
        assert.equal(ready.state, 'success', ready.error);
        assert.equal(ready.importId, prepared);
        assert.equal(inspectReadableZip(path.join(control, 'imports', prepared, 'uploaded.zip'), null, zipPass).encrypted, true);

        assert.equal(fs.existsSync(path.join(control, 'staging', second)), false);
        assert.equal(fs.existsSync(path.join(control, 'profiles.json')), true);
        // Missing USB marker must fail instead of writing to an SD-card directory.
        fs.rmSync(path.join(targets, 'usb/.whisky-backup-target'));
        const failed = queue('run');
        await worker.processQueue();
        assert.equal(worker.getStatus().jobs.find(j => j.id === failed).state, 'failed');
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        for (const [key, value] of Object.entries(original)) {
            if (value === undefined) delete process.env[key]; else process.env[key] = value;
        }
        fs.rmSync(root, { recursive: true, force: true });
    }
});
