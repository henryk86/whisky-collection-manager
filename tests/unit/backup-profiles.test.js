import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateProfile, validateRelativePath } from '../../server/services/backups.js';
import { dueSlot, repositoryFor } from '../../worker/backup-worker.js';
import { renderBackupSection, profileForm } from '../../public/js/views/backups.js';

const valid = { name: 'Dropbox täglich', provider: 'dropbox', remote: 'my_dropbox', targetPath: 'whisky/backups',
    enabled: true, schedule: { frequency: 'daily', hour: 2, minute: 30, weekday: 0 },
    retention: { daily: 7, weekly: 4, monthly: 12 } };
test('backup profile: typed and bounded provider, schedule, retention, target', () => {
    assert.deepEqual(validateProfile(valid).schedule, valid.schedule);
    assert.equal(validateProfile(valid).format, 'zip');
    assert.throws(() => validateProfile({ ...valid, format: 'restic' }), /Format/);
    assert.throws(() => validateProfile({ ...valid, format: 'unknown' }), /Format/);
    assert.equal(validateProfile({ ...valid, provider: 'local', remote: 'ignored' }).remote, '');
    for (const targetPath of ['../etc', '/root', 'usb/../secret', 'usb//foo', '.', 'x\\y', '.hidden', 'usb/foo:', 'foo/']) {
        assert.throws(() => validateRelativePath(targetPath), targetPath);
    }
    assert.throws(() => validateProfile({ ...valid, remote: 'my:other' }), /Rclone/);
    assert.throws(() => validateProfile({ ...valid, provider: 'unknown' }), /Anbieter/);
    assert.throws(() => validateProfile({ ...valid, schedule: { ...valid.schedule, minute: 61 } }), /Minute/);
    assert.throws(() => validateProfile({ ...valid, retention: { daily: 0, weekly: 0, monthly: 0 } }), /Aufbewahrung/);
});
test('backup scheduler is deterministic and respects weekly/hourly/daily slots in Berlin time', () => {
    const at0210 = new Date('2026-11-07T01:10:00.000Z'); // Saturday, Berlin 02:10
    const sat = { enabled: true, format: 'zip', schedule: { frequency: 'daily', hour: 2, minute: 0, weekday: 6 } };
    assert.equal(dueSlot(sat, at0210), '2026-11-07');
    assert.equal(dueSlot({ ...sat, schedule: { ...sat.schedule, hour: 3 } }, at0210), null);
    assert.equal(dueSlot({ ...sat, schedule: { ...sat.schedule, frequency: 'weekly', weekday: 6 } }, at0210), '2026-11-07');
    assert.equal(dueSlot({ ...sat, schedule: { ...sat.schedule, frequency: 'weekly', weekday: 1 } }, at0210), null);
    assert.equal(dueSlot({ ...sat, schedule: { ...sat.schedule, frequency: 'hourly', minute: 10 } }, at0210), '2026-11-07T02');
    assert.equal(dueSlot({ ...sat, schedule: { ...sat.schedule, frequency: 'hourly', minute: 11 } }, at0210), null);
    assert.equal(dueSlot({ ...sat, enabled: false }, at0210), null);
    assert.equal(dueSlot({ ...sat, format: undefined }, at0210), null, 'legacy Restic schedule disabled');
});
test('Rclone repositories are isolated; local targets require mounted-drive marker', () => {
    assert.equal(repositoryFor(valid), 'rclone:my_dropbox:whisky/backups');
    // Marker guard: absent marker must fail rather than silently backing up to host SD card.
    assert.throws(() => repositoryFor({ ...valid, provider: 'local', remote: '' }), /Backup-Marker/);
});
test('backup UI escapes names and errors; never renders credentials', () => {
    const malicious = { ...valid, format: 'zip', id: 'fake', name: '<script>alert(1)</script>' };
    const state = { backupUnlocked: true, backupDashboard: { profiles: [malicious], jobs: [{ state: 'failed', error: '<img src=x onerror=alert(1)>', profileId: 'fake', type: 'run' }], worker: { online: true }, snapshots: {}, remotes: [], timeZone: 'Europe/Berlin' } };
    const html = renderBackupSection(state);
    assert.match(html, /&lt;script&gt;/);
    assert.doesNotMatch(html, /<script>|<img src=x/);
    assert.match(html, /data-act="backup-run"/);
    assert.match(html, /data-act="backup-restore"/);
    assert.match(profileForm(malicious, ['dropbox']), /id="backup-profile-form"/);
    assert.match(profileForm({}, [], [{name:'usb',label:'USB-Stick'}]), /AES-256-Passwortschutz/);
    assert.match(profileForm({}, [], [{name:'usb',label:'USB-Stick'}]), /usb\/whisky-zip/);
    assert.match(renderBackupSection({ backupUnlocked: false, backupDashboard: null }), /backup-admin-key/);
});

test('one backup screen provides direct ZIP, scheduled profiles and full restore without a duplicate download', () => {
    const locked = renderBackupSection({ backupUnlocked: false, backupDashboard: null });
    const unlocked = renderBackupSection({ backupUnlocked: true, backupDashboard: {
        profiles: [], jobs: [], worker: { online: true }, snapshots: {}, targets: [], remotes: [], passwordConfigured: true
    } });
    for (const html of [locked, unlocked]) {
        assert.equal((html.match(/href="\/api\/export\/zip"/g) || []).length, 0);
        assert.match(html, /Backup direkt herunterladen/);
        assert.match(html, /Automatische Backups/);
        assert.match(html, /Wiederherstellen|Backup einspielen/);
    }
    assert.match(unlocked, /data-act="backup-manual-download"/);
    assert.match(unlocked, /id="backup-password-form"/);
    assert.match(unlocked, /id="backup-import-zip-form"/);
    assert.match(unlocked, /data-act="backup-new"/);
    const settingsSource = fs.readFileSync(new URL('../../public/js/views/settings.js', import.meta.url), 'utf8');
    assert.doesNotMatch(settingsSource, /\/api\/export\/zip/, 'no second full ZIP export in the settings view');
});

test('version footer is derived from server metadata and ZIP exports require unlock', () => {
    const shellSource = fs.readFileSync(new URL('../../public/js/ui/shell.js', import.meta.url), 'utf8');
    const routeSource = fs.readFileSync(new URL('../../server/routes.js', import.meta.url), 'utf8');
    assert.match(shellSource, /state\.version/);
    assert.ok(routeSource.includes('api\\/version'));
    assert.match(routeSource, /exports\.exportZip\(req\)/);
    const unlockedNoPassword = renderBackupSection({ backupUnlocked: true, backupDashboard: {
        profiles: [], jobs: [], worker: { online: true }, snapshots: {}, targets: [], remotes: [], passwordConfigured: false
    } });
    assert.doesNotMatch(unlockedNoPassword, /data-act="backup-manual-download"/);
    assert.match(unlockedNoPassword, /Backup-Passwort festlegen/);
});
