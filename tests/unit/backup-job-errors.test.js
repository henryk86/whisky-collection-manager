import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { backupJobError, serializeBackupJobError } from '../../shared/backup-job-errors.js';
import { jobErrorText } from '../../public/js/i18n/job-errors.js';
import { renderBackupSection } from '../../public/js/views/backups.js';

test('structured worker errors preserve known causes and only bounded, neutral parameters', () => {
    const error = backupJobError('backup.errors.sourceSnapshotFailed', {
        status: '503', secret: '<script>hidden</script>', tooLong: 's'.repeat(101)
    });
    assert.deepEqual(serializeBackupJobError(error), {
        errorCode: 'backup.errors.sourceSnapshotFailed',
        errorParams: {status:'503'}
    });
    assert.deepEqual(serializeBackupJobError({code:'ENOSPC',message:'secret'}), {errorCode:'backup.errors.diskFull'});
    assert.deepEqual(serializeBackupJobError({code:'EACCES',message:'secret'}), {errorCode:'backup.errors.permissionDenied'});
    assert.deepEqual(serializeBackupJobError({code:'ENOENT',message:'secret'}), {errorCode:'backup.errors.missingFile'});
    assert.deepEqual(serializeBackupJobError({backupCommand:'rclone', message:'access token'}), {errorCode:'backup.errors.rcloneFailed'});
    assert.deepEqual(serializeBackupJobError(new Error('credential abc')), {errorCode:'backup.errors.unexpected'});
});

test('backup job list displays specific structured code, not raw error text', () => {
    const job = {
        id:'job', type:'run', state:'failed', profileId:'profile',
        errorCode:'backup.errors.mountMarkerMissing', error:'<img src=x onerror=alert(1)>'
    };
    const html = renderBackupSection({backupUnlocked:true, backupDashboard:{
        profiles:[], targets:[], jobs:[job], worker:{online:true}, snapshots:{}, remotes:[], timeZone:'Europe/Berlin'
    }});
    assert.match(html, /Backup-Marker fehlt/);
    assert.doesNotMatch(html, /onerror=|img src=/);
    assert.equal(jobErrorText(job), 'Backup-Ziel nicht bereit: USB-/NAS-Laufwerk ist nicht korrekt eingehängt (Backup-Marker fehlt).');
});


test('command diagnostics preserve causes but redact credentials, paths, controls and long output', async () => {
    const { sanitizeBackupDiagnostic, commandFailureDiagnostic } = await import('../../worker/backup-diagnostics.js');
    const output = "\u001b[31mCRITICAL: couldn't fetch token: invalid_grant: maybe token expired?" +
        ' password=sensitivePW123 access_token: xYzToken123456789' +
        ' Authorization: Bearer aBCdef0123456789' +
        ' https://user:secret@example.org/path?refresh_token=supersecret' +
        ' config /run/secrets/rclone-private.conf' +
        ' key=123456789012345678901234567890123456789012345678901234' +
        ' token=shortSecret123 \"token\":\"anotherSecret\" password=123456\n';
    const diagnostic = sanitizeBackupDiagnostic(output);
    assert.match(diagnostic, /invalid_grant: maybe token expired/);
    assert.doesNotMatch(diagnostic, /sensitivePW123|xYzToken123456789|aBCdef0123456789|secret@example|supersecret|rclone-private\.conf|123456789012345678901234|shortSecret123|anotherSecret|123456/);
    assert.doesNotMatch(diagnostic, /\u001b|\n/);
    assert.ok(diagnostic.length <= 700);
    assert.match(commandFailureDiagnostic('rclone', 1, null, output), /rclone \(Exit 1\):/);
    assert.ok(sanitizeBackupDiagnostic('x'.repeat(4000)).length <= 700);
});


test('unexpected worker failures report safe exception type, source position and system code to operators only', async () => {
    const { logBackupJobFailure, unexpectedBackupDiagnostic } = await import('../../worker/backup-diagnostics.js');
    const code = {errorCode:'backup.errors.unexpected'};
    const failures = [];
    const oldError = console.error;
    try {
        console.error = message => failures.push(message);
        const programming = new TypeError('password=never-show-me; /home/operator/private/secret.json');
        programming.stack = 'TypeError: password=never-show-me\n' +
            '    at perform (/home/operator/private/worker/backup-worker.js:421:22)\n' +
            '    at async /home/operator/private/worker/backup-worker.js:440:11';
        logBackupJobFailure('job-programming', code, programming);
        assert.match(failures[0], /job-programming.*backup\.errors\.unexpected.*TypeError; Position backup-worker\.js:421:22/);
        assert.doesNotMatch(failures[0], /never-show-me|operator|secret\.json|\/home\//);
        assert.deepEqual(serializeBackupJobError(programming), code);

        const filesystem = Object.assign(new Error('EISDIR: illegal operation on a directory, read /run/secrets/password'), {code:'EISDIR'});
        filesystem.stack = 'Error: EISDIR\n    at readFileSync (node:fs:452:1)\n' +
            '    at load (/srv/whisky/shared/backup-password.js:24:16)';
        logBackupJobFailure('job-file', code, filesystem);
        assert.match(failures[1], /job-file.*Systemcode EISDIR; Position backup-password\.js:24:16/);
        assert.doesNotMatch(failures[1], /\/srv\/|\/run\/secrets|illegal operation/);

        const unusual = new Error('refresh_token=never-show');
        unusual.name = 'SuperSensitiveErrorToken';
        unusual.stack = 'SuperSensitiveErrorToken: refresh_token=never-show';
        assert.equal(unexpectedBackupDiagnostic(unusual), 'Fehler; Quellposition nicht verfügbar');
        logBackupJobFailure('job-no-stack', code, unusual);
        assert.doesNotMatch(failures[2], /never-show|SuperSensitive/);
    } finally {
        console.error = oldError;
    }
});

test('backup management missing has a specific localizable code in both language catalogs', () => {
    const de = JSON.parse(fs.readFileSync(new URL('../../public/locales/de.json', import.meta.url), 'utf8'));
    const en = JSON.parse(fs.readFileSync(new URL('../../public/locales/en.json', import.meta.url), 'utf8'));
    for (const catalog of [de, en]) {
        assert.ok(catalog['backup.errors.controlNotConfigured']);
        assert.notEqual(catalog['backup.errors.controlNotConfigured'], catalog['backup.errors.unexpected']);
    }
});
