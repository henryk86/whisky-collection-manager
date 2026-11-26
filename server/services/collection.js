import {read, change} from '../storage/collection-store.js';
import {migrateCollectionToCurrent} from '../storage/migrations.js';
import {suggestNumber} from '../domain/inventory.js';
/**
 * Retrieves collection for collection.
 *
 * @return {import('../../shared/types.js').Collection} Current validated collection snapshot.
 */
export function getCollection() {
  return read();
}

/**
 * Retrieves next inventory number for collection.
 *
 * @return {!Object} Next available inventory number in the number property.
 */
export function getNextInventoryNumber() {
  return {number: suggestNumber(read()), };
}

/**
 * Explicit full replacement. Reserved inventory numbers survive imports and
 * deletions.
 *
 * @param {*} input Input to process.
 * @return {!Promise<!Object>} Import confirmation and resulting collection statistics.
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
