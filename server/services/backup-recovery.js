/** Admin-gated, two-step ZIP restoration. Upload -> validate/preview ->
 * explicit apply.
 * The live collection is never touched by an upload or preview.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {authorizeAdmin} from './backups.js';
import {fail} from '../domain/errors.js';
import {runExclusive, invalidateCollectionCache}
  from '../storage/collection-store.js';
import {emptyWarehouse, invalidateWarehouseCache} from '../storage/warehouse-store.js';
import {validatePreview, fileDigest} from '../storage/restore-validation.js';
import {RESTORE_FOLDERS, restoreDirectories, installRestore, hasInterruptedRestore} from '../storage/restore-transaction.js';
import {ensureDurableDirectory, syncDirectory, writeDurableFile} from '../../shared/durable-files.js';
import {ROOT, BACKUP_DIR} from '../storage/paths.js';
import {writeReadableZip, inspectReadableZip} from '../../shared/backup-zip.js';
import {readBackupPassword} from '../../shared/backup-password.js';

const ID = /^[0-9a-f]{8}-[0-9a-f-]{20,50}$/i;
const LIMIT = 2 * 1024 * 1024 * 1024; // streamed to disk, not buffered in memory
const CONTROL = process.env.BACKUP_CONTROL_DIR ? path.resolve(process.env.BACKUP_CONTROL_DIR) : null;
/**
 * Decodes the ZIP-password header and rejects malformed URI encoding.
 *
 * @param {*} req Incoming request to authorize.
 * @return {string} URI-decoded ZIP password header, or empty text when absent.
 */
function suppliedPassword(req) {
  try {return decodeURIComponent(req.headers['x-backup-zip-password'] || '');}
  catch {
    throw fail('Ungültige Passwort-Zeichenkodierung', 400, "api.errors.invalidPasswordEncoding");
  }
}

/**
 * Validates the restore ID and resolves its staging directory under backup control storage.
 * @param {string} id Restore job identifier.
 * @return {string} Absolute restore staging directory.
 */
function pathFor(id) {
  if (!ID.test(id)) throw fail('Ungültige Wiederherstellungs-ID', 400, "api.errors.invalidRestoreID");
  if (!CONTROL) throw fail('Backup-Verwaltung nicht eingerichtet', 503, "api.errors.backupManagementIsNotConfigured");
  return path.join(CONTROL, 'imports', id);
}

/** @typedef {ReturnType<typeof validatePreview>} PreviewSummary */
/** @typedef {{digest: string, summary: PreviewSummary}} VerifiedPreview */

/**
 * Authenticates and extracts a ZIP, validates every live store and referenced file, and binds the confirmed counts to its exact bytes. Plaintext preview files are discarded after validation.
 * @param {string} dir Private import directory.
 * @param {string} password Archive password supplied by the administrator.
 * @return {Object} Archive metadata and validated collection counts.
 */
function verifyPreview(dir, password) {
  const archive = path.join(dir, 'uploaded.zip');
  const preview = path.join(dir, 'preview');
  const proof = path.join(dir, 'preview.json');
  fs.rmSync(proof, {force: true});
  fs.rmSync(preview, {recursive: true, force: true});
  try {
    const digest = fileDigest(archive);
    const zip = inspectReadableZip(archive, preview, password);
    const summary = validatePreview(preview);
    if (fileDigest(archive) !== digest) throw fail('ZIP muss erneut geprüft werden', 409, 'api.errors.restorePreviewChanged');
    writeDurableFile(proof, JSON.stringify({digest, summary}) + '\n');
    return {...zip, ...summary};
  } catch (error) {
    fs.rmSync(proof, {force: true});
    throw error;
  } finally {fs.rmSync(preview, {recursive: true, force: true});}
}

/**
 * Requires the exact archive whose preview was validated. Missing or changed archives must be unlocked again.
 * @param {string} dir Private import directory.
 * @return {VerifiedPreview} Digest and counts recorded for the confirmed archive.
 */
function requirePreview(dir) {
  let proof;
  try {proof = JSON.parse(fs.readFileSync(path.join(dir, 'preview.json'), 'utf8'));}
  catch {throw fail('ZIP muss erneut geprüft werden', 409, 'api.errors.restorePreviewChanged');}
  if (typeof proof?.digest !== 'string' || !/^[a-f0-9]{64}$/.test(proof.digest) ||
    !['bottlings', 'bottles', 'distilleries'].every(key => Number.isSafeInteger(proof.summary?.[key]) && proof.summary[key] >= 0) ||
    fileDigest(path.join(dir, 'uploaded.zip')) !== proof.digest) {
    throw fail('ZIP muss erneut geprüft werden', 409, 'api.errors.restorePreviewChanged');
  }
  return proof;
}

/**
 * Removes or resets old imports.
 */
function removeOldImports() {
  const base = path.join(CONTROL, 'imports');
  try {
    for (const entry of fs.readdirSync(base, {withFileTypes: true})) {
      if (!entry.isDirectory() || !ID.test(entry.name)) continue;
      const folder = path.join(base, entry.name);
      if (Date.now() - fs.statSync(folder).mtimeMs > 24 * 3600000) fs.rmSync(folder, {recursive: true, force: true});
    }
  } catch { /* no old imports */}
}

/**
 * Validates and stages an incoming backup ZIP for restoration.
 *
 * @param {!Object} req Incoming HTTP request.
 * @return {!Promise<!Object>} Staged archive identifier and validated restore-preview information.
 */
export async function receiveZip(req) {
  authorizeAdmin(req);
  if (!['application/zip', 'application/octet-stream'].includes((req.headers['content-type'] || '').split(';')[0].trim())) {
    throw fail('Bitte eine ZIP-Datei auswählen', 415, "api.errors.pleaseSelectAZIPFile");
  }
  if (Number(req.headers['content-length'] || 0) > LIMIT) throw fail('ZIP-Upload ist zu groß', 413, "api.errors.zipUploadIsTooLarge");
  removeOldImports();
  const id = crypto.randomUUID();
  const dir = pathFor(id);
  ensureDurableDirectory(dir);
  const archive = path.join(dir, 'uploaded.zip');
  const fd = fs.openSync(archive, 'wx', 0o600);
  let bytes = 0;
  try {
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > LIMIT) throw fail('ZIP-Upload ist zu groß', 413, "api.errors.zipUploadIsTooLarge");
      let written = 0;
      while (written < chunk.length) written += fs.writeSync(fd, chunk, written, chunk.length - written);
    }
    fs.fsyncSync(fd);
    syncDirectory(dir);
  } catch (error) {
    fs.closeSync(fd);
    fs.rmSync(dir, {recursive: true, force: true});
    throw error;
  }
  fs.closeSync(fd);
  try {
    const preview = verifyPreview(dir, suppliedPassword(req));
    return {
      id, ...preview,
      message: 'ZIP geprüft. Die laufende Sammlung wurde noch nicht verändert.',
    };
  } catch (error) {
    fs.rmSync(dir, {recursive: true, force: true});
    if (error.status) throw error;
    throw fail(`ZIP konnte nicht geprüft werden: ${error.message}`, 400, "api.errors.zipCouldNotBeVerified");
  }
}

/**
 * Restores validated backup contents into application storage.
 *
 * @param {!Object} req Incoming HTTP request.
 * @param {string} id Identifier used to select the relevant record.
 * @param {*} input Input to process.
 * @return {!Promise<!Object>} Confirmation of successful application of the validated restore archive.
 */
export async function applyZip(req, id, input) {
  authorizeAdmin(req);
  if (input?.acknowledge !== true) throw fail('Wiederherstellung muss ausdrücklich bestätigt werden', 400, "api.errors.restoreMustBeExplicitlyConfirmed");
  const dir = pathFor(id);
  const archive = path.join(dir, 'uploaded.zip');
  if (!fs.existsSync(archive)) throw fail('Hochgeladene Sicherung nicht gefunden', 404, 'api.errors.uploadedBackupNotFound');
  return runExclusive(() => {
    const {digest} = requirePreview(dir);
    const transactionId = crypto.randomUUID();
    const {fresh} = restoreDirectories(ROOT, transactionId);
    fs.mkdirSync(fresh, {mode: 0o700});
    let committed = false;
    try {
      // Never trust the mutable preview directory as the restore source. Extract and authenticate the confirmed archive again.
      try {inspectReadableZip(archive, fresh, input?.password || '');}
      catch (error) {throw fail(`ZIP-Prüfung fehlgeschlagen: ${error.message}`, 400, 'api.errors.zipVerificationFailed');}
      if (fileDigest(archive) !== digest) throw fail('ZIP muss erneut geprüft werden', 409, 'api.errors.restorePreviewChanged');
      for (const name of RESTORE_FOLDERS) ensureDurableDirectory(path.join(fresh, name));
      const warehouseFile = path.join(fresh, 'data', 'warehouse.json');
      if (!fs.existsSync(warehouseFile)) writeDurableFile(warehouseFile, JSON.stringify(emptyWarehouse(), null, 2) + '\n');
      const userFile = path.join(fresh, 'data', 'user.json');
      // Older backups did not contain accounts. Do not reset the running installation's authentication policy.
      if (!fs.existsSync(userFile)) writeDurableFile(userFile, fs.readFileSync(path.join(ROOT, 'data', 'user.json')));
      const summary = validatePreview(fresh, {writeMigrated: true});
      ensureDurableDirectory(BACKUP_DIR);
      const safetyName = `pre-restore-${transactionId}.zip`;
      const safetyPath = path.join(BACKUP_DIR, safetyName);
      const zipPassword = readBackupPassword();
      const safetyTemporary = `${safetyPath}.part`;
      try {
        writeReadableZip(ROOT, safetyTemporary, zipPassword);
        inspectReadableZip(safetyTemporary, null, zipPassword);
        fs.renameSync(safetyTemporary, safetyPath);
        syncDirectory(BACKUP_DIR);
      } finally {fs.rmSync(safetyTemporary, {force: true});}
      const {cleanupStatus} = installRestore(ROOT, transactionId);
      committed = true;
      invalidateCollectionCache();
      invalidateWarehouseCache();
      try {fs.rmSync(dir, {recursive: true, force: true});}
      catch (error) {console.warn('Committed restore: import cleanup failed.', error.code);}
      return {
        applied: true,
        cleanupStatus,
        ...summary,
        safetyBackup: path.join('backups', safetyName),
        message: cleanupStatus !== 'complete' ? 'Sicherung übernommen. Bereinigung nicht vollständig bestätigt; Speichermedium prüfen und Server neu starten.' :
          'Sicherung übernommen. Vorherige Sammlung als Sicherheits-ZIP gespeichert.',
      };
    } finally {
      // After commit the transaction owns cleanup; do not turn success into a staging-cleanup error.
      // Recovery also owns the staging directories as long as a journal remains.
      if (!committed && !hasInterruptedRestore(ROOT)) fs.rmSync(fresh, {recursive: true, force: true});
    }
  });
}

/**
 * Preview a previously uploaded ZIP or a saved archive prepared by the worker.
 *
 * @param {!Object} req Incoming HTTP request.
 * @param {string} id Identifier used to select the relevant record.
 * @return {!Object} Prepared archive metadata and current validated restore preview.
 */
export function previewZip(req, id) {
  authorizeAdmin(req);
  const dir = pathFor(id);
  const archive = path.join(dir, 'uploaded.zip');
  if (!fs.existsSync(archive)) throw fail('Sicherung nicht gefunden', 404, 'api.errors.backupNotFound');
  const {digest, summary} = requirePreview(dir);
  const result = inspectReadableZip(archive, null, suppliedPassword(req));
  if (fileDigest(archive) !== digest) throw fail('ZIP muss erneut geprüft werden', 409, 'api.errors.restorePreviewChanged');
  return {id, ...result, ...summary};
}

/**
 * Explicit password check after a worker has staged a saved archive; no
 * passwords in job JSON.
 *
 * @param {!Object} req Incoming HTTP request.
 * @param {string} id Identifier used to select the relevant record.
 * @param {*} input Input to process.
 * @return {!Object} Unlocked archive metadata and validated restore preview.
 */
export function unlockPreparedZip(req, id, input) {
  authorizeAdmin(req);
  const dir = pathFor(id);
  const archive = path.join(dir, 'uploaded.zip');
  if (!fs.existsSync(archive)) throw fail('Vorbereitete Sicherung nicht gefunden', 404, "api.errors.preparedBackupNotFound");
  try {return {id, ...verifyPreview(dir, input?.password || '')};}
  catch (error) {
    if (error.status) throw error;
    throw fail(`ZIP konnte nicht geprüft werden: ${error.message}`, 400, 'api.errors.zipCouldNotBeVerified');
  }
}

/**
 * Allows an existing Restic snapshot, converted by the worker, to be saved as
 * a portable ZIP.
 *
 * @param {!Object} req Incoming HTTP request.
 * @param {string} id Identifier used to select the relevant record.
 * @return {!Object} File-download descriptor for the prepared portable ZIP archive.
 */
export function downloadPreparedZip(req, id) {
  authorizeAdmin(req);
  const dir = pathFor(id);
  const filename = path.join(dir, 'uploaded.zip');
  if (!fs.existsSync(filename) || !fs.lstatSync(filename).isFile()) throw fail('Vorbereitete Sicherung nicht gefunden', 404, "api.errors.preparedBackupNotFound");
  return {
    path: filename,
    filename: 'whisky-backup-wiederherstellung.zip',
    type: 'application/zip',
  };
}
