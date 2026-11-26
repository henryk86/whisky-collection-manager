import {takeMutationUpdates, takeUpdatedResource} from '../api.js';
import {synchronizeWarehouseProjection}
  from '../../../shared/warehouse-bottle-projection.js';
/**
 * Refresh only resources known to be affected by a mutation. Unknown/mixed
 * mutations deliberately use both endpoints. The cache module retains
 * revalidation semantics for every resource actually requested.
 *
 * @param {!Object} state Current application state.
 * @param {*} getJson Asynchronous JSON request function used to fetch missing or invalidated resources.
 * @param {string=} scope Resource domain affected by the operation.
 * @return {!Promise<*>} Promise fulfilled when the operation completes.
 */
export async function loadResources(state, getJson, scope = 'all') {
  if (!['all', 'collection', 'warehouse'].includes(scope)) throw new Error(`Unknown refresh scope: ${scope}`);
  const changed = takeMutationUpdates();
  const patchedCollection = takeUpdatedResource('collection', changed);
  const patchedWarehouse = takeUpdatedResource('warehouse', changed);
  const collection = scope !== 'warehouse' || !state.collection
    ? patchedCollection ? Promise.resolve(patchedCollection) : getJson('/api/collection') : Promise.resolve(state.collection);
  const warehouse = scope !== 'collection' || !state.warehouse
    ? patchedWarehouse ? Promise.resolve(patchedWarehouse) : getJson('/api/warehouse') : Promise.resolve(state.warehouse);
  // Preserve resources that loaded successfully even when a different GET
  // fails. A committed POST may have supplied a valid collection delta:
  // dropping it would make navigation appear to lose the saved record.
  const [collectionResult, warehouseResult] = await Promise.allSettled([collection, warehouse]);
  if (collectionResult.status === 'fulfilled') state.collection = collectionResult.value;
  if (warehouseResult.status === 'fulfilled') state.warehouse = warehouseResult.value;
  if (changed.has('collection') && !changed.has('warehouse') && collectionResult.status === 'fulfilled' && state.warehouse) {
    state.warehouse = synchronizeWarehouseProjection(state.warehouse, state.collection);
  }
  if (collectionResult.status === 'rejected') throw collectionResult.reason;
  if (warehouseResult.status === 'rejected') throw warehouseResult.reason;
  return state;
}
