/** Persistent shared ZIP password for app and scheduler, never returned by an API. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const BACKUP_PASSWORD_FAILURE = Object.freeze({
  missing: 'BACKUP_PASSWORD_MISSING',
  tooShort: 'BACKUP_PASSWORD_TOO_SHORT',
  controlMissing: 'BACKUP_CONTROL_NOT_CONFIGURED'
});
function passwordError(code, message) {
  return Object.assign(new Error(message), {backupPasswordCode: code});
}

function passwordPath() {
  const control = process.env.BACKUP_CONTROL_DIR;
  if (!control) throw passwordError(BACKUP_PASSWORD_FAILURE.controlMissing, 'Backup-Verwaltung nicht eingerichtet');
  return path.join(path.resolve(control), 'backup-zip-password');
}
export function readBackupPassword() {
  try {
    const value = fs.readFileSync(passwordPath(), 'utf8').replace(/\r?\n$/, '');
    if (value.length < 14) throw passwordError(BACKUP_PASSWORD_FAILURE.tooShort, 'Gespeichertes Backup-Passwort ist zu kurz');
    return value;
  } catch (error) {
    if (error.code === 'ENOENT') throw passwordError(BACKUP_PASSWORD_FAILURE.missing, 'Backup-Passwort noch nicht eingerichtet. Bitte in der Backup-Verwaltung festlegen.');
    throw error;
  }
}
export function hasBackupPassword() {
  try {readBackupPassword(); return true;}
  catch (error) {
    if (error.backupPasswordCode === BACKUP_PASSWORD_FAILURE.missing) return false;
    throw error;
  }
}
export function saveBackupPassword(password, previous = '') {
  if (typeof password !== 'string' || password.length < 14 || password.length > 256 || !password.trim()) {
    throw Error('Backup-Passwort muss zwischen 14 und 256 Zeichen lang sein.');
  }
  if (hasBackupPassword()) {
    const old = Buffer.from(readBackupPassword());
    const supplied = Buffer.from(typeof previous === 'string' ? previous : '');
    if (old.length !== supplied.length || !crypto.timingSafeEqual(old, supplied)) {
      throw Error('Bisheriges Backup-Passwort ist falsch.');
    }
  }
  const to = passwordPath();
  fs.mkdirSync(path.dirname(to), {recursive: true, mode: 0o700});
  const temp = `${to}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temp, `${password}\n`, {flag: 'wx', mode: 0o600});
    fs.renameSync(temp, to);
    fs.chmodSync(to, 0o600);
  } finally {fs.rmSync(temp, {force: true});}
}
