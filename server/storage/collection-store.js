/**
 * The only writer of collection.json. Serialize mutations and commit by atomic
 * rename.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {DATA_DIR, IMAGE_DIR, DOCUMENT_DIR, BACKUP_DIR, DATA_FILE}
  from './paths.js';
import {validate} from '../domain/validation.js';
import {trackMutation} from '../domain/mutation-tracker.js';
import {migrateCollectionToCurrent} from './migrations.js';
const seedFile = new URL('../../seed/distillery.json', import.meta.url);

/**
 * Creates the initial schema-6 collection with curated distilleries.
 *
 * @return {import('../../shared/types.js').Collection} New collection state;
 * the seed catalog is loaded from disk.
 */
export const empty = () => ({
  schemaVersion: 6,
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
let revision = crypto.randomUUID();
/**
 * Produces the identity text used by the caller.
 * @return {string} Collection file metadata fingerprint for cache invalidation.
 */
const identity = () => {
  const {dev, ino, size, mtimeMs, ctimeMs} = fs.statSync(DATA_FILE);
  return `${dev}:${ino}:${size}:${mtimeMs}:${ctimeMs}`;
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
 * Retrieves current from the available state.
 */
function loadCurrent() {
  const current = identity();
  if (cached === null || cachedIdentity !== current) {
    // A foreign file replacement or restore is never silently reused.
    cached = structuredClone(validate(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))));
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
    fs.mkdirSync(directory, {recursive: true, });
  }
  if (!fs.existsSync(DATA_FILE)) {
    atomicWrite(empty());
  }
  const original = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const migration = migrateCollectionToCurrent(original);
  if (migration.changed) {
    // No modifications until the migration is valid AND an exact copy is safe.
    const backup = path.join(BACKUP_DIR, `pre-schema6-${Date.now()}-${crypto.randomUUID()}.json`);
    fs.copyFileSync(DATA_FILE, backup, fs.constants.COPYFILE_EXCL);
    if (migration.conflicts.length) {
      const report = path.join(BACKUP_DIR, `inventory-conflicts-${Date.now()}-${crypto.randomUUID()}.json`);
      fs.writeFileSync(report, JSON.stringify(migration.conflicts, null, 2) + '\n');
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
 * Validates and atomically replaces the persisted collection file.
 * Writes via a temporary file and rename; refreshes cache and revision only on
 * success.
 *
 * @param {import('../../shared/types.js').Collection} value Complete new
 * state.
 * @throws {Error} If validation or the atomic file write fails.
 */
export function atomicWrite(value) {
  validate(value);
  fs.mkdirSync(DATA_DIR, {recursive: true, });
  const temporaryFile = `${DATA_FILE}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryFile, JSON.stringify(value, null, 2) + '\n', {
      flag: 'wx', mode: 0o600,
    });
    fs.renameSync(temporaryFile, DATA_FILE);
    cached = structuredClone(value);
    cachedIdentity = identity();
    revision = crypto.randomUUID();
  }
  finally {
    if (fs.existsSync(temporaryFile)) {
      fs.unlinkSync(temporaryFile);
    }
  }
}
let queue = Promise.resolve();
/**
 * Serializes mutations against the latest committed collection.
 *
 * A rejected mutation leaves storage untouched and does not poison the queue.
 *
 * @template T
 * @param {function(import('../../shared/types.js').Collection):
 *     (T|!Promise<T>)} mutator Mutates a private copy and returns a result.
 * @return {!Promise<T>} Result after the collection write is committed.
 */
export function change(mutator) {
  const work = queue.then(async () => {
    const collection = read();
    const result = await mutator(collection);
    const previous = cached;
    const beforeEtag = collectionETag();
    atomicWrite(collection);
    trackMutation('collection', previous, collection, beforeEtag, collectionETag());
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
 * @param {function(): (T|!Promise<T>)} task Restore or other exclusive work.
 * @return {!Promise<T>} Operation result when its turn completes.
 */
export function runExclusive(task) {
  const work = queue.then(task);
  queue = work.catch(() => {});
  return work;
}
