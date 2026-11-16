/** The only writer of collection.json. Serialize mutations and commit by atomic rename. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR, IMAGE_DIR, DOCUMENT_DIR, BACKUP_DIR, DATA_FILE } from './paths.js';
import { validate } from '../domain/validation.js';
import { migrateCollectionToCurrent } from './migrations.js';
const seedFile = new URL('../../seed/distillery.json', import.meta.url);
export const empty = () => ({
    schemaVersion: 5, nextInventoryNumber: 1, reservedInventoryNumbers: [], settings: { establishedYear: null }, distilleries: JSON.parse(fs.readFileSync(seedFile, 'utf8')), bottlings: [], externalTastings: [], tastingFlights: []
});
let cached = null;
let cachedIdentity = null;
let revision = crypto.randomUUID();
const identity = () => {
    const {dev, ino, size, mtimeMs, ctimeMs} = fs.statSync(DATA_FILE);
    return `${dev}:${ino}:${size}:${mtimeMs}:${ctimeMs}`;
};
/** A restore or external replacement must invalidate both data and validator. */
export function invalidateCollectionCache() {
    cached = null;
    cachedIdentity = null;
    revision = crypto.randomUUID();
}
function loadCurrent() {
    const current = identity();
    if (cached === null || cachedIdentity !== current) {
        // A foreign file replacement or restore is never silently reused.
        cached = structuredClone(validate(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))));
        cachedIdentity = current;
        revision = crypto.randomUUID();
    }
}
export function collectionETag() {
    loadCurrent();
    return `W/"collection-${revision}"`;
}
export function initialize() {
    invalidateCollectionCache();
    for (const directory of [DATA_DIR, IMAGE_DIR, DOCUMENT_DIR, BACKUP_DIR]) {
        fs.mkdirSync(directory, {
            recursive: true
        });
    }
    if (!fs.existsSync(DATA_FILE)) {
        atomicWrite(empty());
    }
    const original = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const migration = migrateCollectionToCurrent(original);
    if (migration.changed) {
        // No modifications until the migration is valid AND an exact copy is safe.
        const backup = path.join(BACKUP_DIR, `pre-schema5-${Date.now()}-${crypto.randomUUID()}.json`);
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
/** @returns {import('../../shared/types.js').Collection} */
export function read() {
    loadCurrent();
    return structuredClone(cached);
}
export function atomicWrite(value) {
    validate(value);
    fs.mkdirSync(DATA_DIR, {
        recursive: true
    });
    const temporaryFile = `${DATA_FILE}.${process.pid}.${crypto.randomUUID()}.tmp`;
    try {
        fs.writeFileSync(temporaryFile, JSON.stringify(value, null, 2) + '\n', {
            flag: 'wx', mode: 0o600
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
 * Each mutation reads the latest committed document inside the queue. A failed
 * mutation never commits and does not poison later writes.
 * @template T
 * @param {(collection: import('../../shared/types.js').Collection) => T|Promise<T>} mutator
 * @returns {Promise<T>}
 */
export function change(mutator) {
    const work = queue.then(async () => {
        const collection = read();
        const result = await mutator(collection);
        atomicWrite(collection);
        return result;
    });
    queue = work.catch(() => {
    });
    return work;
}
/** Serialize full restores behind any in-flight collection mutations. */
export function runExclusive(task) {
    const work = queue.then(task);
    queue = work.catch(() => {});
    return work;
}
