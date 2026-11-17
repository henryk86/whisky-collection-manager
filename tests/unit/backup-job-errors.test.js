import test from 'node:test';
import assert from 'node:assert/strict';
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
