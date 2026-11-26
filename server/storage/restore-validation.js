/** Validates an extracted backup against the same data contracts as live storage. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fail} from '../domain/errors.js';
import {loadCollectionFiles, writeCollectionFiles, hasCollectionTransaction} from './collection-files.js';
import {validateWarehouse, emptyWarehouse} from './warehouse-store.js';
import {validateStore} from '../domain/auth-store.js';
import {imageSignatureMatches} from './photos.js';

/**
 * Computes SHA-256 with bounded memory, including for large backup archives.
 * @param {string} filename Regular file to hash.
 * @return {string} Lowercase SHA-256 digest.
 */
export function fileDigest(filename) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(filename, 'r');
  const buffer = Buffer.alloc(1024 * 1024);
  try {
    let count;
    while ((count = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, count));
  } finally {fs.closeSync(fd);}
  return hash.digest('hex');
}

/**
 * Reads file metadata for an attachment already validated by the collection or warehouse schema.
 * @param {string} root Extracted archive root.
 * @param {string} relative Referenced media path within that root.
 * @return {fs.Stats} Metadata of the existing nonempty regular file.
 */
function requireMedia(root, relative) {
  try {
    const filename = path.resolve(root, relative);
    if (!filename.startsWith(path.resolve(root) + path.sep)) throw Error('Media path escapes restore');
    const stat = fs.lstatSync(filename);
    if (stat.isFile() && stat.size > 0) return stat;
  } catch { /* A missing or unsafe reference invalidates the backup. */}
  throw fail(`Ungültige oder fehlende Mediendatei: ${relative}`, 400, 'api.errors.invalidRestoreMedia');
}

/**
 * Verifies the referenced image exists and has the same format signature required by image uploads.
 * @param {string} root Extracted archive root.
 * @param {string} relative Validated relative image path.
 */
function requireImage(root, relative) {
  requireMedia(root, relative);
  const fd = fs.openSync(path.join(root, relative), 'r');
  const header = Buffer.alloc(12);
  try {
    const count = fs.readSync(fd, header, 0, header.length, 0);
    if (!imageSignatureMatches(path.extname(relative).slice(1).toLowerCase(), header.subarray(0, count))) {
      throw fail(`Ungültige Bildsignatur: ${relative}`, 400, 'api.errors.invalidRestoreMedia');
    }
  } finally {fs.closeSync(fd);}
}

/**
 * Validates all live image references and the size and digest of each document. Unreferenced files are retained for historical recovery.
 * @param {string} root Extracted archive root.
 * @param {import('../../shared/types.js').Collection} collection Validated, migrated collection.
 * @param {!Object} warehouse Validated warehouse, possibly empty for a legacy archive.
 */
function validateMedia(root, collection, warehouse) {
  for (const bottling of collection.bottlings) {
    // Legacy image references are still accepted by the collection schema.
    const legacy = /** @type {import('../../shared/types.js').Bottling & {images?: {bottle?: string, box?: string}}} */ (bottling).images;
    for (const image of [legacy?.bottle, legacy?.box].filter(Boolean)) requireImage(root, image);
    for (const bottle of bottling.bottles) {
      for (const photo of bottle.photos || []) {
        for (const image of [photo.path, photo.cutout?.path, photo.adjustment?.path, photo.cutout?.adjustment?.path].filter(Boolean)) requireImage(root, image);
      }
      for (const document of bottle.files || []) {
        const stat = requireMedia(root, document.path);
        if (stat.size !== document.size || fileDigest(path.join(root, document.path)) !== document.sha256.toLowerCase()) {
          throw fail(`Ungültige Dokument-Prüfsumme oder Größe: ${document.path}`, 400, 'api.errors.invalidRestoreMedia');
        }
      }
    }
  }
  for (const room of warehouse.rooms) {
    for (const furniture of room.furniture) {
      for (const photo of furniture.photos || []) requireImage(root, photo.path);
    }
  }
  // Stale bottle assignments are intentionally supported by the live warehouse model. Its validator still rejects unknown shelf IDs.
}

/**
 * Validates all persisted data stores and their media references before a restore can be previewed or installed. Missing warehouse and account files are supported for old archives; an installation must preserve current accounts when absent.
 * @param {string} root Extracted archive root.
 * @param {{writeMigrated?: boolean}=} options Whether to persist collection schema upgrades in the staging tree.
 * @return {{bottlings: number, bottles: number, distilleries: number}} Collection preview counts.
 */
export function validatePreview(root, {writeMigrated = false} = {}) {
  const directory = path.join(root, 'data');
  let migration;
  try {
    if (hasCollectionTransaction(directory)) throw Error('Unfinished collection transaction in backup');
    migration = loadCollectionFiles(directory);
  }
  catch {throw fail('ZIP enthält keine gültige Whisky-Sammlung', 400, 'api.errors.zipDoesNotContainAValidWhiskyCollection');}
  const warehouseFile = path.join(root, 'data', 'warehouse.json');
  let warehouse = emptyWarehouse();
  if (fs.existsSync(warehouseFile)) {
    try {warehouse = validateWarehouse(JSON.parse(fs.readFileSync(warehouseFile, 'utf8')));}
    catch {throw fail('Ungültige Lagerdatei', 400, 'api.errors.invalidStorageFile');}
  }
  const userFile = path.join(root, 'data', 'user.json');
  if (fs.existsSync(userFile)) {
    try {validateStore(JSON.parse(fs.readFileSync(userFile, 'utf8')));}
    catch {throw fail('Ungültige Benutzerdatei in ZIP-Sicherung', 400, 'api.errors.invalidRestoreUsers');}
  }
  const db = migration.collection;
  validateMedia(root, db, warehouse);
  if (writeMigrated && migration.changed) writeCollectionFiles(directory, db);
  return {
    bottlings: db.bottlings.length,
    bottles: db.bottlings.reduce((sum, item) => sum + item.bottles.length, 0),
    distilleries: db.distilleries.length,
  };
}
