import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import https from 'node:https';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';

const write = (p, content) => {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, { mode: 0o600 });
};
const freePort = async () => {
    const server = net.createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    await new Promise(resolve => server.close(resolve));
    return port;
};
const tlsGet = (port, ca, url) => new Promise((resolve, reject) => {
    const req = https.get(`https://127.0.0.1:${port}${url}`, { ca, timeout: 1200 }, res => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve({ code: res.statusCode, data: JSON.parse(Buffer.concat(chunks).toString('utf8')) }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
});

test('one container process supervises app + worker; verified TLS loopback, real backup queue, no HTTP listener', { timeout: 35000 }, async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'whisky-single-container-'));
    const port = await freePort();
    const httpPort = await freePort();
    const cert = path.join(dir, 'server-cert.pem');
    const key = path.join(dir, 'server-key.pem');
    const control = path.join(dir, 'control');
    const targets = path.join(dir, 'targets');
    const bin = path.join(dir, 'bin');
    const profileId = crypto.randomUUID();
    const jobId = crypto.randomUUID();
    const token = 'b'.repeat(64);
    const logfile = path.join(dir, 'restic.log');
    const adminFile = path.join(dir, 'admin-token');
    const workerFile = path.join(dir, 'worker-token');
    const passwordFile = path.join(dir, 'restic-password');
    const configFile = path.join(dir, 'rclone.conf');
    const profile = { id: profileId, format: 'zip', provider: 'local', remote: '', targetPath: 'usb/whisky', enabled: false, schedule: {
        frequency: 'daily', hour: 2, minute: 0, weekday: 0
    }, retention: { daily: 7, weekly: 4, monthly: 12 } };
    const fakeRestic = `#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_RESTIC_LOG"
case " $* " in
  *' backup '*) test -f data/collection.json || exit 17 ;;
  *' snapshots --json '*) printf '[]\\n' ;;
esac
exit 0
`;
    let processRunner;
    let output = '';
    try {
        execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '2',
            '-keyout', key, '-out', cert, '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' });
        write(adminFile, 'a'.repeat(64));
        write(workerFile, token);
        write(passwordFile, 'c'.repeat(64));
        write(path.join(control, 'backup-zip-password'), 'SicheresTestpasswort-2026-mindestens-14!');
        write(configFile, '');
        write(path.join(targets, 'usb/.whisky-backup-target'), 'mounted');
        write(path.join(control, 'profiles.json'), JSON.stringify({ version: 1, profiles: [profile] }));
        write(path.join(control, 'jobs', `${jobId}.json`), JSON.stringify({ id: jobId, profileId, type: 'run', createdAt: new Date().toISOString() }));
        write(path.join(bin, 'restic'), fakeRestic);
        write(path.join(bin, 'rclone'), '#!/bin/sh\nexit 0\n');
        fs.chmodSync(path.join(bin, 'restic'), 0o700);
        fs.chmodSync(path.join(bin, 'rclone'), 0o700);
        processRunner = spawn(process.execPath, ['docker/entrypoint.js'], {
            cwd: process.cwd(), env: {
                ...process.env, PATH: bin + path.delimiter + process.env.PATH,
                NODE_ENV: 'production', HOST: '127.0.0.1', HTTPS_ENABLED: 'true', HTTP_ENABLED: 'false',
                HTTPS_PORT: String(port), PORT: String(httpPort),
                HTTPS_CERT_FILE: cert, HTTPS_KEY_FILE: key,
                APP_INTERNAL_URL: `https://127.0.0.1:${port}`, NODE_EXTRA_CA_CERTS: cert,
                WHISKY_DATA_DIR: path.join(dir, 'storage'),
                BACKUP_CONTROL_DIR: control, BACKUP_TARGET_ROOT: targets,
                BACKUP_ADMIN_TOKEN_FILE: adminFile, BACKUP_WORKER_TOKEN_FILE: workerFile,
                RESTIC_PASSWORD_FILE: passwordFile, RCLONE_CONFIG: configFile,
                FAKE_RESTIC_LOG: logfile, HOME: path.join(control, 'home')
            }, stdio: ['ignore', 'pipe', 'pipe']
        });
        processRunner.stdout.on('data', b => { output = (output + b.toString()).slice(-12000); });
        processRunner.stderr.on('data', b => { output = (output + b.toString()).slice(-12000); });
        let finished = false;
        for (let i = 0; i < 130; i++) {
            if (processRunner.exitCode !== null) break;
            const statusFile = path.join(control, 'worker-status.json');
            if (fs.existsSync(statusFile)) {
                const status = JSON.parse(fs.readFileSync(statusFile));
                if (status.jobs.some(job => job.id === jobId && job.state === 'success')) {
                    finished = true; break;
                }
                if (status.jobs.some(job => job.id === jobId && job.state === 'failed')) {
                    assert.fail(`Backup job failed: ${JSON.stringify(status.jobs)} ${output}`);
                }
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        assert.equal(finished, true, `worker never completed end-to-end HTTPS snapshot: ${output}`);
        const res = await tlsGet(port, fs.readFileSync(cert), '/api/collection');
        assert.equal(res.code, 200);
        assert.ok(res.data);
        const { inspectReadableZip } = await import('../../shared/backup-zip.js');
        const target = path.join(targets, 'usb/whisky');
        const zipFiles = fs.readdirSync(target).filter(name => name.endsWith('.zip'));
        assert.equal(zipFiles.length, 1, 'single ZIP backup generated');
        assert.ok(inspectReadableZip(path.join(target, zipFiles[0]), null, 'SicheresTestpasswort-2026-mindestens-14!').files >= 2);
        assert.equal(fs.existsSync(logfile), false, 'new backups must not invoke Restic');
        assert.equal(fs.existsSync(path.join(control, 'staging', jobId)), false);
        const httpConnects = await new Promise(resolve => {
            const req = http.get(`http://127.0.0.1:${httpPort}/api/collection`, { timeout: 750 });
            req.on('response', res => { res.resume(); resolve(true); });
            req.on('timeout', () => req.destroy());
            req.on('error', () => resolve(false));
        });
        assert.equal(httpConnects, false, 'HTTP_ENABLED=false must not open HTTP listener');
    } finally {
        if (processRunner && processRunner.exitCode === null) {
            const exited = new Promise(resolve => processRunner.once('exit', resolve));
            processRunner.kill('SIGTERM');
            await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 2500))]);
            if (processRunner.exitCode === null) processRunner.kill('SIGKILL');
        }
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
