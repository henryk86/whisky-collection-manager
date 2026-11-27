import {bottlingName} from './bottling-name.js';
/** One collection -> warehouse-bottle projection on client and server.
 * Pure function: changing tasting notes never alters room or shelf assignments.
 */
import {displayPhotoPath} from './photo-images.js';
/**
 * Computes warehouse bottle entries from the current collection state.
 * projection.
 *
 * @param {!Object} collection Collection data being processed.
 * @return {*} Physical-bottle descriptors projected from collection bottlings for warehouse display.
 */
export function projectedWarehouseBottles(collection) {
  return (collection?.bottlings || []).flatMap(bottling =>
    (bottling.bottles || []).map(bottle => ({
      id: bottle.id,
      bottlingId: bottling.id,
      name: bottlingName(bottling),
      number: bottle.inventoryNumber || '',
      volumeType: bottle.volumeType || 'standard',
      status: bottle.status,
      ageYears: bottling.ageYears ?? null,
      releaseYear: bottling.releaseYear ?? null,
      caskType: bottling.caskType || null,
      volumeMl: bottle.volumeMl ?? bottling.volumeMl ?? null,
      photoPath: displayPhotoPath(bottle.photos?.find(entry => typeof entry?.path === 'string' && entry.path)) || null,
    })));
}

/**
 * Rebuilds the warehouse's bottle projection and removes assignments to missing physical bottles.
 * @param {Object|null|undefined} warehouse Current warehouse data, if available.
 * @param {import('./types.js').Collection} collection Current collection with physical inventory.
 * @return {Object|null|undefined} Warehouse projection, or the original nullish input when no warehouse is supplied.
 */
export function synchronizeWarehouseProjection(warehouse, collection) {
  if (!warehouse) return warehouse;
  const bottles = projectedWarehouseBottles(collection);
  const known = new Set(bottles.map(b => b.id));
  return {
    ...warehouse, bottles,
    assignments: Object.fromEntries(Object.entries(warehouse.assignments || {}).filter(([id]) => known.has(id))),
    staleAssignments: Object.keys(warehouse.assignments || {}).filter(id => !known.has(id)).length,
  };
}
