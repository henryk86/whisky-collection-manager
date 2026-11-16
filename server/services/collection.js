import { read, change } from '../storage/collection-store.js';
import { migrateCollection } from '../storage/migrations.js';
import { validate } from '../domain/validation.js';
import { suggestNumber } from '../domain/inventory.js';
export function getCollection() {
    return read();
}
export function getNextInventoryNumber() {
    return {
        number: suggestNumber(read())
    };
}
/** Explicit full replacement. Reserved inventory numbers survive imports and deletions. */
export async function importCollection(input) {
    const migration = migrateCollection(input);
    validate(input);
    await change(collection => {
        input.reservedInventoryNumbers = [...new Set([...input.reservedInventoryNumbers, ...collection.reservedInventoryNumbers])];
        for (const key of Object.keys(collection)) {
            delete collection[key];
        }
        Object.assign(collection, input);
    });
    return {
        ok: true, inventoryConflicts: migration.conflicts
    };
}
