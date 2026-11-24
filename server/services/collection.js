import {read, change} from '../storage/collection-store.js';
import {migrateCollectionToCurrent} from '../storage/migrations.js';
import {suggestNumber} from '../domain/inventory.js';
export function getCollection() {
  return read();
}

export function getNextInventoryNumber() {
  return {
    number: suggestNumber(read()),
  };
}

/**
 * Explicit full replacement. Reserved inventory numbers survive imports and
 * deletions.
 */
export async function importCollection(input) {
  const migrated = migrateCollectionToCurrent(input).collection;
  await change(collection => {
    migrated.reservedInventoryNumbers = [...new Set([
      ...migrated.reservedInventoryNumbers,
      ...collection.reservedInventoryNumbers,
    ])];
    for (const key of Object.keys(collection)) {
      delete collection[key];
    }
    Object.assign(collection, migrated);
  });
  return {
    ok: true, inventoryConflicts: [],
  };
}
