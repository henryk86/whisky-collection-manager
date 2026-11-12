import fs from 'node:fs';
/** Legacy migrations are isolated from normal CRUD. Each step is safe to run again. */
import { assert } from '../domain/errors.js';
import { allBottles, now, uid } from '../domain/collection.js';
const internationalSeed = JSON.parse(fs.readFileSync(new URL('../../seed/distillery.json', import.meta.url), 'utf8'));

// Convert legacy top-level bottles into the owning bottling before validation.
export function migrateNestedBottles(db) {
    let changed = false;
    if (db.schemaVersion === 1) {
        db.schemaVersion = 2;
        changed = true;
    }
    if (Array.isArray(db.bottles)) {
        for (const bottling of db.bottlings || []) {
            if (!Array.isArray(bottling.bottles)) {
                bottling.bottles = [];
            }
        }
        for (const bottle of db.bottles) {
            const owner = (db.bottlings || []).find(b => b.id === bottle.bottlingId);
            assert(owner, 'Verwaiste Flasche kann nicht migriert werden');
            if (owner.bottles.some(b => b.id === bottle.id)) {
                throw new Error('Doppelte Flaschen-ID bei Migration');
            }
            const { bottlingId, ...nested } = bottle;
            owner.bottles.push(nested);
        }
        delete db.bottles;
        changed = true;
    }
    for (const bottling of db.bottlings || []) {
        if (!Array.isArray(bottling.bottles)) {
            bottling.bottles = [];
            changed = true;
        }
        for (const bottle of bottling.bottles) {
            if (Object.hasOwn(bottle, 'bottlingId')) {
                delete bottle.bottlingId;
                changed = true;
            }
        }
    }
    return changed;
}
// From v0.5.9 onward the printed/scanned inventory number is the only identifier.
// Conflicting legacy fields are logged in an external migration report, never
// silently used as an additional identification field.
export function migrateInventoryNumbers(db) {
    let changed = false;
    const conflicts = [];
    for (const bottling of db.bottlings || []) {
        for (const bottle of bottling.bottles || []) {
            const previous = String(bottle.inventoryNumber ?? '').trim();
            if (Object.hasOwn(bottle, 'labelCode')) {
                const label = String(bottle.labelCode ?? '').trim();
                if (!previous && label) {
                    bottle.inventoryNumber = label;
                }
                else if (previous && label && previous !== label) {
                    conflicts.push({
                        bottlingId: bottling.id, bottleId: bottle.id,
                        inventoryNumber: previous, previousLabelCode: label
                    });
                }
                delete bottle.labelCode;
                changed = true;
            }
            if (bottle.inventoryNumber != null && String(bottle.inventoryNumber) !== String(bottle.inventoryNumber).trim()) {
                bottle.inventoryNumber = String(bottle.inventoryNumber).trim();
                changed = true;
            }
            const number = String(bottle.inventoryNumber || '');
            // Previously a label-only code wasn't necessarily reserved as an inventory number.
            if (number && !db.reservedInventoryNumbers.includes(number)) {
                db.reservedInventoryNumbers.push(number);
                changed = true;
            }
            if (/^\d+$/.test(number)) {
                const asNumber = Number(number);
                if (Number.isSafeInteger(asNumber) && asNumber >= db.nextInventoryNumber) {
                    db.nextInventoryNumber = asNumber + 1;
                    changed = true;
                }
            }
        }
    }
    if (db.schemaVersion === 2) {
        db.schemaVersion = 3;
        changed = true;
    }
    return {
        changed, conflicts
    };
}
export function migrateLabelTypes(db) {
    let changed = false;
    for (const bottle of allBottles(db)) {
        if (Object.hasOwn(bottle, 'labelType')) {
            delete bottle.labelType;
            changed = true;
        }
    }
    return changed;
}
export function migrateDistilleries(db) {
    let changed = false;
    for (const b of db.bottlings || []) {
        if (!Array.isArray(b.distilleryIds)) {
            b.distilleryIds = b.distilleryId ? [b.distilleryId] : [];
            changed = true;
        }
        if (Object.hasOwn(b, 'distilleryId')) {
            delete b.distilleryId;
            changed = true;
        }
    }
    return changed;
}
export function migratePhotos(db) {
    let changed = false;
    for (const bottle of allBottles(db)) {
        if (!Array.isArray(bottle.photos)) {
            bottle.photos = [];
            changed = true;
        }
    }
    for (const bottling of db.bottlings || []) {
        if (!bottling.images) {
            continue;
        }
        const first = (bottling.bottles || [])[0];
        if (!first) {
            continue;
        } // Retain orphaned legacy references rather than lose them.
        for (const kind of ['bottle', 'box']) {
            const file = bottling.images[kind];
            if (file && !first.photos.some(p => p.path === file)) {
                first.photos.push({
                    id: uid(), path: file, createdAt: now(), legacyType: kind
                });
            }
        }
        delete bottling.images;
        changed = true;
    }
    return changed;
}
/** Move the former bottling-wide sample type to individual physical bottles.
 * Keep bottling.volumeMl as the nominal size published by the producer;
 * each bottle additionally receives its own actual size when known.
 */
export function migrateBottleTypes(db) {
    let changed = false;
    for (const bottling of db.bottlings || []) {
        const oldType = bottling.volumeType === 'sample' ? 'sample' : 'standard';
        for (const bottle of bottling.bottles || []) {
            if (!['standard', 'sample'].includes(bottle.volumeType)) {
                bottle.volumeType = oldType;
                changed = true;
            }
            if (!Object.hasOwn(bottle, 'volumeMl') && bottling.volumeMl != null) {
                bottle.volumeMl = bottling.volumeMl;
                changed = true;
            }
        }
        if (Object.hasOwn(bottling, 'volumeType')) {
            delete bottling.volumeType;
            changed = true;
        }
    }
    if (db.schemaVersion === 3) {
        db.schemaVersion = 4;
        changed = true;
    }
    return changed;
}
/** Existing collections can gain the optional document list without data loss. */
export function migrateDocumentLists(db) {
    let changed = false;
    for (const bottle of allBottles(db)) {
        if (bottle.files === undefined) {
            bottle.files = [];
            changed = true;
        }
    }
    return changed;
}
/** Add newly published international sites without overwriting user changes. */
export function migrateInternationalDistilleries(db) {
    if (!Array.isArray(db.distilleries)) return false;
    const currentNames = new Set(db.distilleries.map(d => d.name.trim().toLocaleLowerCase('en')));
    const currentIds = new Set(db.distilleries.map(d => d.id));
    let changed = false;
    for (const entry of internationalSeed.filter(d => d.country)) {
        if (currentNames.has(entry.name.trim().toLocaleLowerCase('en')) || currentIds.has(entry.id)) continue;
        db.distilleries.push({ ...entry });
        currentNames.add(entry.name.trim().toLocaleLowerCase('en'));
        currentIds.add(entry.id);
        changed = true;
    }
    return changed;
}
/** Fill missing origin metadata from the published distillery catalogue.
 * Never change user-set status, coordinates or explicit geographic fields.
 * Country/region belong to distilleries, not to individual bottlings.
 */
export function migrateDistilleryOrigins(db) {
    if (!Array.isArray(db.distilleries)) return false;
    const catalog = new Map(internationalSeed.map(d => [d.name.trim().toLocaleLowerCase('en'), d]));
    let changed = false;
    for (const site of db.distilleries) {
        const known = catalog.get(site.name.trim().toLocaleLowerCase('en'));
        if (!known) continue;
        // Historic generic UK codes conceal the Scottish origin of a known site.
        // Do not reinterpret UK for unknown sites, Wales, England or Northern Ireland.
        if (known.country === 'Schottland' && /^(?:UK|GB|United Kingdom|Vereinigtes Königreich)$/i.test(site.country?.trim() || '')) {
            site.country = 'Schottland';
            changed = true;
        }
        for (const key of ['country', 'region']) {
            if (!site[key]?.trim() && known[key]) {
                site[key] = known[key];
                changed = true;
            }
        }
    }
    return changed;
}
/** Mutates a parsed document only. The caller backs up and commits it after validation. */
export function migrateCollection(collection) {
    assert(collection && typeof collection === 'object' && !Array.isArray(collection), 'Ungültige Sammlungsstruktur');
    assert(Array.isArray(collection.bottlings) && Array.isArray(collection.reservedInventoryNumbers), 'Ungültige Sammlungsstruktur');
    const changes = [
        migrateNestedBottles(collection),
        migrateDistilleries(collection),
        migratePhotos(collection),
        migrateLabelTypes(collection),
        migrateDocumentLists(collection),
        migrateInternationalDistilleries(collection),
        migrateDistilleryOrigins(collection),
    ];
    const inventory = migrateInventoryNumbers(collection);
    changes.push(migrateBottleTypes(collection));
    return {
        changed: changes.some(Boolean) || inventory.changed, conflicts: inventory.conflicts
    };
}
