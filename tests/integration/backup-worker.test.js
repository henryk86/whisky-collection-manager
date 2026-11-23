import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';

const create = (dir, relative, text, mode = 0o600) => {
  const file = path.join(dir, relative); fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, text, {mode}); return file;
};
test('legacy Restic profiles are no longer written, but old backups remain verifiable and restorable', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'whisky-worker-'));
  const control = path.join(folder, 'control');
  const bin = path.join(folder, 'bin');
  fs.mkdirSync(bin);
  fs.mkdirSync(path.join(control, 'jobs'), {recursive: true});
  const logfile = path.join(folder, 'called.log');
  const restic = create(folder, 'bin/restic', `#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_RESTIC_LOG"
case " $* " in
  *' snapshots --json '*) printf '[]\\n' ;;
  *' backup '*) test -f data/collection.json && test -f images/pic.png && test -f documents/bill.pdf || exit 8 ;;
  *' restore '*) while [ "$#" -gt 0 ]; do if [ "$1" = '--target' ]; then shift; mkdir -p "$1"; echo restored > "$1/restored.txt"; mkdir -p "$1/data"; echo '{"schemaVersion":6}' > "$1/data/collection.json"; break; fi; shift; done ;;
esac
exit 0
`, 0o700);
  const rclone = create(folder, 'bin/rclone', `#!/bin/sh
case "$1" in listremotes) echo 'dropbox:';; lsd) exit 0;; esac
`, 0o700);
  fs.chmodSync(restic, 0o700); fs.chmodSync(rclone, 0o700);
  const pass = create(folder, 'restic-pass', 'a'.repeat(64));
  const token = create(folder, 'worker-token', 'b'.repeat(64));
  const config = create(folder, 'rclone.conf', '[dropbox]\ntype = dropbox\n');
  const profileId = crypto.randomUUID();
  const profile = {
    id: profileId, name: 'Dropbox', provider: 'dropbox', remote: 'dropbox', targetPath: 'whisky', enabled: false,
    schedule: {frequency: 'daily', hour: 3, minute: 0, weekday: 0}, retention: {daily: 7, weekly: 4, monthly: 12}
  };
  create(control, 'backup-zip-password', 'SicheresTestpasswort-2026-mindestens-14!');
  create(control, 'profiles.json', JSON.stringify({version: 1, profiles: [profile]}));
  const originals = Object.fromEntries(['BACKUP_CONTROL_DIR', 'BACKUP_TARGET_ROOT', 'BACKUP_WORKER_TOKEN_FILE', 'RESTIC_PASSWORD_FILE', 'RCLONE_CONFIG', 'FAKE_RESTIC_LOG', 'APP_INTERNAL_URL', 'PATH'].map(k => [k, process.env[k]]));
  let server;
  try {
    server = http.createServer((req, res) => {
      if (req.method !== 'POST' || !req.url.startsWith('/internal/backup/snapshot/') || req.headers['x-backup-worker-token'] !== 'b'.repeat(64)) {
        res.writeHead(403); return res.end('{}');
      }
      const id = req.url.split('/').at(-1);
      create(control, `staging/${id}/data/collection.json`, '{"schemaVersion":6}');
      create(control, `staging/${id}/images/pic.png`, 'photo');
      create(control, `staging/${id}/documents/bill.pdf`, 'invoice');
      res.setHeader('Content-Type', 'application/json'); res.end('{}');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    Object.assign(process.env, {
      BACKUP_CONTROL_DIR: control, BACKUP_TARGET_ROOT: path.join(folder, 'targets'),
      BACKUP_WORKER_TOKEN_FILE: token, RESTIC_PASSWORD_FILE: pass,
      RCLONE_CONFIG: config, FAKE_RESTIC_LOG: logfile,
      APP_INTERNAL_URL: `http://127.0.0.1:${port}`, PATH: `${bin}:${process.env.PATH}`
    });
    const {createWorker} = await import('../../worker/backup-worker.js?integration');
    const worker = createWorker();
    const queue = (type, extra = {}) => {
      const id = crypto.randomUUID();
      create(control, `jobs/${id}.json`, JSON.stringify({id, profileId, type, createdAt: new Date().toISOString(), ...extra}));
      return id;
    };
    const backupId = queue('run');
    await worker.processQueue();
    const dashboard1 = worker.getStatus();
    assert.equal(dashboard1.jobs[0].id, backupId);
    assert.equal(dashboard1.jobs[0].state, 'failed', 'old Restic profile must not create new backups');
    assert.equal(dashboard1.jobs[0].errorCode, 'backup.errors.legacyProfileReadOnly');
    assert.equal(fs.existsSync(logfile), false, 'restic was not invoked for new backups');
    const checkId = queue('check');
    const restoreId = queue('restore', {snapshotId: 'latest'});
    await worker.processQueue();
    const dashboard2 = worker.getStatus();
    assert.equal(dashboard2.jobs.find(j => j.id === checkId).state, 'success');
    assert.equal(dashboard2.jobs.find(j => j.id === restoreId).state, 'success');
    assert.equal(fs.existsSync(path.join(control, 'restores', profileId, restoreId, 'restored.txt')), true);
    const prepareId = queue('prepare', {snapshotId: 'latest'});
    await worker.processQueue();
    const prepared = worker.getStatus().jobs.find(j => j.id === prepareId);
    assert.equal(prepared.state, 'success', prepared.error);
    assert.equal(prepared.importId, prepareId);
    assert.equal(fs.existsSync(path.join(control, 'imports', prepareId, 'uploaded.zip')), true);
    const {inspectReadableZip} = await import('../../shared/backup-zip.js');
    assert.ok(inspectReadableZip(path.join(control, 'imports', prepareId, 'uploaded.zip'), null, 'SicheresTestpasswort-2026-mindestens-14!').files >= 2);
    assert.equal(fs.existsSync(path.join(control, 'profiles.json')), true, 'live config preserved');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    for (const [key, value] of Object.entries(originals)) {if (value === undefined) delete process.env[key]; else process.env[key] = value;}
    fs.rmSync(folder, {recursive: true, force: true});
  }
});


test('failed Rclone and Restic jobs log bounded operator diagnostics without exposing them in status', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'whisky-worker-errors-'));
  const control = path.join(folder, 'control');
  const bin = path.join(folder, 'bin');
  const profiles = [
    {id: crypto.randomUUID(), provider: 'dropbox', remote: 'dropbox', targetPath: 'whisky', format: 'zip', enabled: false},
    {id: crypto.randomUUID(), provider: 'dropbox', remote: 'dropbox', targetPath: 'legacy', enabled: false}
  ];
  create(control, 'profiles.json', JSON.stringify({version: 1, profiles}));
  create(folder, 'bin/rclone', `#!/bin/sh
printf '%s\n' "CRITICAL: couldn't fetch token: invalid_grant: maybe token expired? password=never-log-this access_token=hidden-token path /run/secrets/rclone-secret.conf" >&2
exit 1
`, 0o700);
  create(folder, 'bin/restic', `#!/bin/sh
printf '%s\n' 'Fatal: repository unreachable; Authorization: Bearer superSecretRESTIC1234' >&2
exit 7
`, 0o700);
  const originals = Object.fromEntries(['BACKUP_CONTROL_DIR', 'BACKUP_TARGET_ROOT', 'PATH'].map(k => [k, process.env[k]]));
  const messages = [];
  const originalConsoleError = console.error;
  try {
    Object.assign(process.env, {
      BACKUP_CONTROL_DIR: control,
      BACKUP_TARGET_ROOT: path.join(folder, 'targets'),
      PATH: `${bin}:${process.env.PATH}`
    });
    const {createWorker} = await import('../../worker/backup-worker.js?diagnostics');
    console.error = (...parts) => {messages.push(parts.join(' '));};
    const jobs = profiles.map(profile => {
      const id = crypto.randomUUID();
      create(control, `jobs/${id}.json`, JSON.stringify({id, profileId: profile.id, type: 'snapshots', createdAt: new Date().toISOString()}));
      return id;
    });
    const worker = createWorker();
    await worker.processQueue();
    const status = worker.getStatus();
    assert.equal(status.jobs.length, 2);
    for (const [index, id] of jobs.entries()) {
      const job = status.jobs.find(item => item.id === id);
      assert.equal(job.state, 'failed');
      assert.equal(job.errorCode, index === 0 ? 'backup.errors.rcloneFailed' : 'backup.errors.resticFailed');
      assert.equal(job.error, undefined);
      assert.equal(job.backupDiagnostic, undefined);
      assert.ok(messages.some(message => message.includes(id) && message.includes(job.errorCode)));
    }
    assert.match(messages.join('\n'), /invalid_grant: maybe token expired/);
    assert.match(messages.join('\n'), /repository unreachable/);
    assert.doesNotMatch(messages.join('\n'), /never-log-this|hidden-token|rclone-secret\.conf|superSecretRESTIC1234/);
    assert.doesNotMatch(fs.readFileSync(path.join(control, 'worker-status.json'), 'utf8'),
      /invalid_grant|never-log-this|repository unreachable|hidden-token/);
  } finally {
    console.error = originalConsoleError;
    for (const [key, value] of Object.entries(originals)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(folder, {recursive: true, force: true});
  }
});

test('ZIP worker reports missing and too-short passwords by their stable identifiers', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'whisky-worker-password-'));
  const control = path.join(folder, 'control');
  const targets = path.join(folder, 'targets');
  create(targets, 'usb/.whisky-backup-target', 'mounted');
  const profile = {
    id: crypto.randomUUID(), provider: 'local', targetPath: 'usb/whisky',
    format: 'zip', enabled: false
  };
  create(control, 'profiles.json', JSON.stringify({version: 1, profiles: [profile]}));
  const token = create(folder, 'worker-token', 'valid-test-token');
  const originals = Object.fromEntries(
    ['BACKUP_CONTROL_DIR', 'BACKUP_TARGET_ROOT', 'BACKUP_WORKER_TOKEN_FILE', 'APP_INTERNAL_URL']
      .map(key => [key, process.env[key]])
  );
  let server;
  const originalConsoleError = console.error;
  try {
    server = http.createServer((req, res) => {
      const id = req.url.split('/').at(-1);
      create(control, `staging/${id}/data/collection.json`, '{"schemaVersion":6}');
      res.end('{}');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    Object.assign(process.env, {
      BACKUP_CONTROL_DIR: control,
      BACKUP_TARGET_ROOT: targets,
      BACKUP_WORKER_TOKEN_FILE: token,
      APP_INTERNAL_URL: `http://127.0.0.1:${server.address().port}`
    });
    const {createWorker} = await import('../../worker/backup-worker.js?missing-password');
    const worker = createWorker();
    const queue = () => {
      const id = crypto.randomUUID();
      create(control, `jobs/${id}.json`, JSON.stringify({id, profileId: profile.id, type: 'run'}));
      return id;
    };
    console.error = () => {};
    const missing = queue();
    await worker.processQueue();
    assert.equal(worker.getStatus().jobs.find(j => j.id === missing).errorCode,
      'backup.errors.passwordNotConfigured');
    create(control, 'backup-zip-password', 'short');
    const short = queue();
    await worker.processQueue();
    assert.equal(worker.getStatus().jobs.find(j => j.id === short).errorCode,
      'backup.errors.passwordNotConfigured');
    // The control directory setting is required by the password reader.
    // A missing setting is different from a missing/short password.
    const controlMissing = queue();
    const configuredControl = process.env.BACKUP_CONTROL_DIR;
    delete process.env.BACKUP_CONTROL_DIR;
    try {
      await worker.processQueue();
    } finally {
      process.env.BACKUP_CONTROL_DIR = configuredControl;
    }
    assert.equal(worker.getStatus().jobs.find(j => j.id === controlMissing).errorCode,
      'backup.errors.controlNotConfigured');
    assert.ok(worker.getStatus().jobs.every(j => j.error === undefined));
  } finally {
    console.error = originalConsoleError;
    if (server) await new Promise(resolve => server.close(resolve));
    for (const [key, value] of Object.entries(originals)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(folder, {recursive: true, force: true});
  }
});
