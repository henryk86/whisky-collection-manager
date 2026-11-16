/** One collection -> warehouse-bottle projection on client and server.
 * Pure function: changing tasting notes never alters room or shelf assignments. */
import { displayPhotoPath } from './photo-images.js';
export function projectedWarehouseBottles(collection) {
    return (collection?.bottlings || []).flatMap(bottling => (bottling.bottles || []).map(bottle => ({
        id: bottle.id, bottlingId: bottling.id, name: bottling.name,
        number: bottle.inventoryNumber || '', volumeType: bottle.volumeType || 'standard', status: bottle.status,
        ageYears: bottling.ageYears ?? null, releaseYear: bottling.releaseYear ?? null,
        caskType: bottling.caskType || null,
        volumeMl: bottle.volumeMl ?? bottling.volumeMl ?? null,
        photoPath: displayPhotoPath(bottle.photos?.find(entry => typeof entry?.path === 'string' && entry.path)) || null
    })));
}
export function synchronizeWarehouseProjection(warehouse, collection) {
    if (!warehouse) return warehouse;
    const bottles = projectedWarehouseBottles(collection);
    const known = new Set(bottles.map(b => b.id));
    return {...warehouse, bottles,
        assignments: Object.fromEntries(Object.entries(warehouse.assignments || {}).filter(([id]) => known.has(id))),
        staleAssignments: Object.keys(warehouse.assignments || {}).filter(id => !known.has(id)).length};
}
