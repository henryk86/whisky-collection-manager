import { displayPhotoPath } from './photo-images.js';
/** Read-only selectors; always read the latest collection after a refresh. */
export function createSelectors(state) {
    const distilleryName = id => state.collection.distilleries.find(d => d.id === id)?.name || 'Unbekannte Destillerie';
    const distilleryIds = b => Array.isArray(b.distilleryIds) ? b.distilleryIds : (b.distilleryId ? [b.distilleryId] : []);
    const distilleryNames = b => distilleryIds(b).map(distilleryName).join(', ') || 'Keine Destillerie angegeben';
    const bottles = id => state.collection.bottlings.find(b => b.id === id)?.bottles || [];
    const allBottles = () => state.collection.bottlings.flatMap(b => b.bottles || []);
    const findBottle = id => {
        for (const bottling of state.collection.bottlings) {
            const bottle = (bottling.bottles || []).find(b => b.id === id);
            if (bottle) {
                return {
                    bottle, bottling
                };
            }
        }
        return null;
    };
    const coverPhoto = id => displayPhotoPath(bottles(id).flatMap(b => b.photos || [])[0]);
    return {
        distilleryName, distilleryIds, distilleryNames, bottles, allBottles, findBottle, coverPhoto
    };
}
/** Exact string matching is intentional: 000123 is not the same as 123. */
export function lookupInventoryNumber(collection, value) {
    const number = String(value ?? '').trim();
    if (!number) {
        return null;
    }
    for (const bottling of collection.bottlings) {
        const bottle = (bottling.bottles || []).find(entry => entry.inventoryNumber === number);
        if (bottle) {
            return {
                bottling, bottle
            };
        }
    }
    return null;
}
