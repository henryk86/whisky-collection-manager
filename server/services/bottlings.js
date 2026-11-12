import { change } from '../storage/collection-store.js';
import { normalizeBottle, normalizeBottling } from '../domain/normalization.js';
import { markNumber } from '../domain/inventory.js';
import { now, uid } from '../domain/collection.js';
import { fail } from '../domain/errors.js';
function checkDistilleries(collection, bottling) {
    const knownIds = new Set(collection.distilleries.map(distillery => distillery.id));
    if (bottling.distilleryIds.some(id => !knownIds.has(id))) {
        throw fail('Unbekannte Destillerie');
    }
}
/** Create a bottling and its first physical bottle in one transaction. */
export function createBottling(input) {
    return change(collection => {
        const timestamp = now();
        const bottling = {
            ...normalizeBottling(input), id: uid(), bottles: [], createdAt: timestamp, updatedAt: timestamp
        };
        checkDistilleries(collection, bottling);
        const bottle = {
            ...normalizeBottle(input.firstBottle || {}), id: uid(), photos: [], files: [], createdAt: timestamp, updatedAt: timestamp
        };
        if (bottle.volumeType === 'standard' && bottle.volumeMl == null && bottling.volumeMl != null) {
            bottle.volumeMl = bottling.volumeMl;
        }
        markNumber(collection, bottle.inventoryNumber);
        bottling.bottles.push(bottle);
        collection.bottlings.push(bottling);
        return {
            bottling, bottle
        };
    });
}
export function updateBottling(id, input) {
    return change(collection => {
        const bottling = collection.bottlings.find(entry => entry.id === id);
        if (!bottling) {
            throw fail('Abfüllung nicht gefunden', 404);
        }
        const updated = normalizeBottling(input, bottling);
        checkDistilleries(collection, updated);
        Object.assign(bottling, updated, {
            updatedAt: now()
        });
        return bottling;
    });
}
export function deleteBottling(id) {
    return change(collection => {
        const index = collection.bottlings.findIndex(entry => entry.id === id);
        if (index < 0) {
            throw fail('Abfüllung nicht gefunden', 404);
        }
        if (collection.bottlings[index].bottles.length) {
            throw fail('Zuerst alle zugeordneten Flaschen löschen', 409);
        }
        collection.bottlings.splice(index, 1);
        return {
            ok: true
        };
    });
}
