/**
 * The only writer of the logical collection and its five physical JSON files.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {DATA_DIR, IMAGE_DIR, DOCUMENT_DIR, BACKUP_DIR, DATA_FILE}
  from './paths.js';
import {validate} from '../domain/validation.js';
import {fail} from '../domain/errors.js';
import {PublishedWriteError, ensureDurableDirectory, syncFile, syncDirectory, writeDurableFile} from '../../shared/durable-files.js';
import {trackMutation} from '../domain/mutation-tracker.js';
import {COLLECTION_FILES, loadCollectionFiles, recoverCollectionTransaction, writeCollectionFiles, hasCollectionTransaction} from './collection-files.js';
const seedFile = new URL('../../seed/distillery.json', import.meta.url);

/**
 * Creates the initial schema-9 collection with curated distilleries.
 *
 * @return {import('../../shared/types.js').Collection} New collection state;
 * the seed catalog is loaded from disk.
 */
export const empty = () => ({
  schemaVersion: 10,
  nextInventoryNumber: 1,
  reservedInventoryNumbers: [],
  settings: {establishedYear: null, },
  distilleries: JSON.parse(fs.readFileSync(seedFile, 'utf8')),
  bottlings: [],
  externalTastings: [],
  tastingFlights: [],
});

let cached = null;
let cachedIdentity = null;
let pendingSync = false;
let revision = crypto.randomUUID();
/**
 * Produces the identity text used by the caller.
 * @return {string} Collection file metadata fingerprint for cache invalidation.
 */
const identity = () => {
  return COLLECTION_FILES.map(name => {
    const {dev, ino, size, mtimeMs, ctimeMs} = fs.statSync(path.join(DATA_DIR, name));
    return `${dev}:${ino}:${size}:${mtimeMs}:${ctimeMs}`;
  }).join('|');
};

/**
 * Invalidates cached collection data after a restore or file replacement.
 * The next read revalidates the on-disk collection and refreshes its ETag.
 */
export function invalidateCollectionCache() {
  cached = null;
  cachedIdentity = null;
  revision = crypto.randomUUID();
}

/**
 * Reloads and validates collection data when the backing file identity changes, invalidating the cached revision.
 */
function loadCurrent() {
  if (hasCollectionTransaction(DATA_DIR)) {
    invalidateCollectionCache();
    pendingSync = true;
    try {
      const status = recoverCollectionTransaction(DATA_DIR);
      if (status === 'pending') throw Error('Collection journal cleanup pending');
    } catch (error) {
      console.warn('Collection recovery required.', error);
      throw fail('Collection recovery required before further access', 503, 'api.errors.collectionRecoveryRequired');
    }
  }
  if (pendingSync) {
    try {syncDirectory(DATA_DIR); pendingSync = false;}
    catch (error) {
      console.warn('Collection directory synchronization required.', error);
      throw fail('Collection recovery required before further access', 503, 'api.errors.collectionRecoveryRequired');
    }
  }
  const current = identity();
  if (cached === null || cachedIdentity !== current) {
    // A foreign file replacement or restore is never silently reused.
    cached = structuredClone(loadCollectionFiles(DATA_DIR).collection);
    cachedIdentity = current;
    revision = crypto.randomUUID();
  }
}

/**
 * Returns a revision-dependent ETag for the current collection.
 *
 * @return {string} Quoted weak HTTP ETag.
 */
export function collectionETag() {
  loadCurrent();
  return `W/"collection-${revision}"`;
}

/**
 * Initializes storage and validates or migrates the collection file.
 * Creates required directories and a pre-migration backup when necessary.
 * Throws if validation or a safe backup fails.
 */
export function initialize() {
  invalidateCollectionCache();
  for (const directory of [DATA_DIR, IMAGE_DIR, DOCUMENT_DIR, BACKUP_DIR]) {
    ensureDurableDirectory(directory);
  }
  const recovered = recoverCollectionTransaction(DATA_DIR);
  if (recovered === 'pending') throw Error('Collection journal cleanup pending');
  if (recovered === 'syncUnconfirmed') syncDirectory(DATA_DIR);
  if (!fs.existsSync(DATA_FILE)) {
    if (COLLECTION_FILES.some(name => fs.existsSync(path.join(DATA_DIR, name)))) throw Error('Collection file missing but separate data exists');
    atomicWrite(empty());
  }
  const migration = loadCollectionFiles(DATA_DIR);
  if (migration.changed) {
    // No modifications until the migration is valid and a complete original snapshot is safe.
    const backup = path.join(BACKUP_DIR, `pre-schema10-${Date.now()}-${crypto.randomUUID()}.json`);
    if (migration.legacySnapshot !== undefined) {
      writeDurableFile(backup, migration.legacySnapshot, {exclusive: true});
    } else {
      fs.copyFileSync(DATA_FILE, backup, fs.constants.COPYFILE_EXCL);
      syncFile(backup);
      syncDirectory(BACKUP_DIR);
    }
    if (migration.conflicts.length) {
      const report = path.join(BACKUP_DIR, `inventory-conflicts-${Date.now()}-${crypto.randomUUID()}.json`);
      writeDurableFile(report, JSON.stringify(migration.conflicts, null, 2) + '\n');
      console.warn(`Inventarnummern-Migration: ${migration.conflicts.length} Konflikte. Bericht: ${report}`);
    }
    // warehouse.json, including rooms, furniture and bottle assignments,
    // is NEVER touched by a collection schema upgrade.
    atomicWrite(migration.collection);
  }
  loadCurrent();
}

/**
 * Returns a validated deep copy of the stored collection.
 *
 * @return {import('../../shared/types.js').Collection} Independent snapshot.
 */
export function read() {
  loadCurrent();
  return structuredClone(cached);
}

/**
 * Validates and commits the changed collection documents.
 * Uses atomic file publication and a durable redo journal for multi-file changes; refreshes cache and revision only on success.
 *
 * @param {import('../../shared/types.js').Collection} value Complete new
 * state.
 * @throws {Error} If validation or the atomic file write fails.
 */
export function atomicWrite(value) {
  validate(value);
  const snapshot = structuredClone(value);
  try {
    const cleanupStatus = writeCollectionFiles(DATA_DIR, snapshot, cached);
    pendingSync = cleanupStatus !== 'complete';
  } catch (error) {
    if (error instanceof PublishedWriteError) pendingSync = true;
    invalidateCollectionCache();
    throw error;
  }
  // Data publication is confirmed. A subsequent metadata/cache failure cannot undo it.
  cached = snapshot;
  revision = crypto.randomUUID();
  try {cachedIdentity = identity();}
  catch (error) {
    cachedIdentity = null;
    console.warn('Committed collection: cache identity unavailable.', error);
  }
}
/** @type {Promise<unknown>} */
let queue = Promise.resolve();
/**
 * Serializes mutations against the latest committed collection.
 *
 * A rejected pre-commit mutation leaves storage untouched. An unresolved published commit is recovered before the next mutation; neither error poisons the queue.
 *
 * @template T
 * @param {(collection: import('../../shared/types.js').Collection) =>
 *     T|Promise<T>} mutator Mutates a private copy and returns a result.
 * @return {!Promise<T>} Result after the collection write is committed.
 */
export function change(mutator) {
  const work = queue.then(async () => {
    const collection = read();
    const result = await mutator(collection);
    const previous = cached;
    const beforeEtag = collectionETag();
    atomicWrite(collection);
    // The commit is already durable. Do not retry cleanup inside the successful response.
    trackMutation('collection', previous, collection, beforeEtag, `W/"collection-${revision}"`);
    return result;
  });
  queue = work.catch(() => {
  });
  return work;
}

/**
 * Queues an exclusive operation behind pending collection mutations.
 *
 * @template T
 * @param {() => T|Promise<T>} task Restore or other exclusive work.
 * @return {!Promise<T>} Operation result when its turn completes.
 */
export function runExclusive(task) {
  const work = queue.then(() => {loadCurrent(); return task();});
  queue = work.catch(() => {});
  return work;
}
