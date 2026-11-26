import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {readBackupPassword, hasBackupPassword, BACKUP_PASSWORD_FAILURE}
  from '../../shared/backup-password.js';

test(
  'backup password availability uses stable error identifiers instead of German messages',
  () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-password-'));
    const old = process.env.BACKUP_CONTROL_DIR;
    try {
      process.env.BACKUP_CONTROL_DIR = folder;
      assert.equal(hasBackupPassword(), false);
      assert.throws(() => readBackupPassword(), error => error.backupPasswordCode === BACKUP_PASSWORD_FAILURE.missing);
      fs.writeFileSync(path.join(folder, 'backup-zip-password'), 'short\n');
      assert.throws(() => readBackupPassword(), error => error.backupPasswordCode === BACKUP_PASSWORD_FAILURE.tooShort);
      assert.throws(() => hasBackupPassword(), error => error.backupPasswordCode === BACKUP_PASSWORD_FAILURE.tooShort);
      fs.writeFileSync(path.join(folder, 'backup-zip-password'), 'LongEnoughPassword12345\n');
      assert.equal(hasBackupPassword(), true);
      delete process.env.BACKUP_CONTROL_DIR;
      assert.throws(() => readBackupPassword(), error =>
        error.backupPasswordCode === BACKUP_PASSWORD_FAILURE.controlMissing);
      assert.throws(() => hasBackupPassword(), error =>
        error.backupPasswordCode === BACKUP_PASSWORD_FAILURE.controlMissing);
    } finally {
      if (old === undefined) delete process.env.BACKUP_CONTROL_DIR;
      else process.env.BACKUP_CONTROL_DIR = old;
      fs.rmSync(folder, {recursive: true, force: true});
    }
  }
);
