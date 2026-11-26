import {read, change} from '../storage/collection-store.js';
import {migrateCollectionToCurrent} from '../storage/migrations.js';
import {suggestNumber} from '../domain/inventory.js';
/**
 * Retrieves collection for collection.
 *
 * @return {import('../../shared/types.js').Collection} Value returned by the delegated operation.
 */
export function getCollection() {
  return read();
}

/**
 * Retrieves next inventory number for collection.
 *
 * @return {!Object} Structured result for the caller.
 */
export function getNextInventoryNumber() {
  return {number: suggestNumber(read()), };
}

/**
 * Explicit full replacement. Reserved inventory numbers survive imports and
 * deletions.
 *
 * @param {*} input Input to process.
 * @return {!Promise<!Object>} Promise fulfilled when the operation completes.
 */
export async function importCollection(input) {
  const migrated = migrateCollectionToCurrent(input).collection;
  await change(collection => {
    migrated.reservedInventoryNumbers = [...new Set([...migrated.reservedInventoryNumbers, ...collection.reservedInventoryNumbers,])];
    for (const key of Object.keys(collection)) {
      delete collection[key];
    }
    Object.assign(collection, migrated);
  });
  return {
    ok: true, inventoryConflicts: [],
  };
}
