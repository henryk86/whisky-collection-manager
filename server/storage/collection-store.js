/** The only writer of collection.json. Serialize mutations and commit by atomic rename. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR, IMAGE_DIR, DOCUMENT_DIR, BACKUP_DIR, DATA_FILE } from './paths.js';
import { validate } from '../domain/validation.js';
import { migrateCollection } from './migrations.js';
const seedFile = new URL('../../seed/distillery.json', import.meta.url);
export const empty = () => ({
    schemaVersion: 4, nextInventoryNumber: 1, reservedInventoryNumbers: [], settings: { establishedYear: null }, distilleries: JSON.parse(fs.readFileSync(seedFile, 'utf8')), bottlings: []
});
export function initialize() {
    for (const directory of [DATA_DIR, IMAGE_DIR, DOCUMENT_DIR, BACKUP_DIR]) {
        fs.mkdirSync(directory, {
            recursive: true
        });
    }
    if (!fs.existsSync(DATA_FILE)) {
        atomicWrite(empty());
    }
    const collection = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const migration = migrateCollection(collection);
    validate(collection);
    if (!migration.changed) {
        return;
    }
    // Preserve the exact original before rewriting any migrated collection.
    const timestamp = Date.now();
    fs.copyFileSync(DATA_FILE, path.join(BACKUP_DIR, `pre-migration-${timestamp}.json`));
    if (migration.conflicts.length) {
        const report = path.join(BACKUP_DIR, `inventory-conflicts-${timestamp}.json`);
        fs.writeFileSync(report, JSON.stringify(migration.conflicts, null, 2) + '\n');
        console.warn(`Inventarnummern-Migration: ${migration.conflicts.length} abweichende alte Etikettencodes. Details: ${report}`);
    }
    atomicWrite(collection);
}
/** @returns {import('../../shared/types.js').Collection} */
export function read() {
    return validate(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')));
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
