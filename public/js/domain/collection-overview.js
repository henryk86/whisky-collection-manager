/** Presentation-only entries: one row per bottling or one row per physical bottle. */
import { bottleStatusLabels, whiskyTypeName } from './labels.js';

export const OVERVIEW_MODES = Object.freeze(['bottlings', 'bottles']);

/** Offer only known distilleries referenced by at least one recorded bottling. */
export function availableOverviewDistilleries(collection) {
    const usedIds = new Set((collection.bottlings || []).flatMap(bottling =>
        Array.isArray(bottling.distilleryIds)
            ? bottling.distilleryIds
            : (bottling.distilleryId ? [bottling.distilleryId] : [])));
    return (collection.distilleries || [])
        .filter(distillery => usedIds.has(distillery.id))
        .sort((left, right) => left.name.localeCompare(right.name, 'de'));
}

function isMatchingBottleType(bottle, volumeType) {
    return volumeType === 'all' || (bottle.volumeType || 'standard') === volumeType;
}

function matchingBottlingText(bottling, distilleryNames) {
    return [bottling.name, distilleryNames(bottling), bottling.bottler, bottling.brand, whiskyTypeName(bottling)];
}

function matchingBottleText(bottle) {
    return [
        bottle.inventoryNumber, bottle.volumeType === 'sample' ? 'Sample Probeflasche' : 'Standardflasche',
        bottleStatusLabels[bottle.status], bottle.volumeMl, bottle.purchaseDate, bottle.merchant,
    ];
}

/** Filter before slicing, so each physical bottle counts as its own result. */
export function collectionOverviewEntries(collection, {
    mode = 'bottlings', search = '', status = 'all', completion = 'all', sort = 'name',
    distillery = 'all', volumeType = 'all', distilleryNames = () => '',
} = {}) {
    const needle = String(search).trim().toLocaleLowerCase('de');
    const entries = [];
    for (const bottling of collection.bottlings) {
        const distilleryIds = Array.isArray(bottling.distilleryIds)
            ? bottling.distilleryIds : (bottling.distilleryId ? [bottling.distilleryId] : []);
        if (distillery !== 'all' && !distilleryIds.includes(distillery)) continue;
        if (completion !== 'all' && bottling.completionStatus !== completion) continue;
        const relatedBottles = bottling.bottles || [];
        const common = matchingBottlingText(bottling, distilleryNames);
        if (mode === 'bottles') {
            for (const bottle of relatedBottles) {
                if (status !== 'all' && bottle.status !== status) continue;
                if (!isMatchingBottleType(bottle, volumeType)) continue;
                const text = [...common, ...matchingBottleText(bottle)].join(' ').toLocaleLowerCase('de');
                if (text.includes(needle)) entries.push({ bottling, bottle });
            }
        } else {
            const matchingBottles = relatedBottles.filter(bottle =>
                (status === 'all' || bottle.status === status) && isMatchingBottleType(bottle, volumeType));
            if ((status !== 'all' || volumeType !== 'all') && !matchingBottles.length) continue;
            const text = [...common, ...matchingBottles.flatMap(matchingBottleText)].join(' ').toLocaleLowerCase('de');
            if (text.includes(needle)) entries.push({ bottling, bottle: null });
        }
    }
    entries.sort((left, right) => {
        const a = left.bottling;
        const b = right.bottling;
        if (sort === 'newest') {
            const leftDate = left.bottle?.createdAt || a.createdAt || '';
            const rightDate = right.bottle?.createdAt || b.createdAt || '';
            if (leftDate !== rightDate) return rightDate.localeCompare(leftDate);
        } else if (sort === 'age') {
            const difference = (b.ageYears ?? -1) - (a.ageYears ?? -1);
            if (difference) return difference;
        } else if (sort === 'year') {
            const difference = (b.releaseYear ?? -1) - (a.releaseYear ?? -1);
            if (difference) return difference;
        }
        const names = a.name.localeCompare(b.name, 'de');
        if (names) return names;
        // Sorting equal bottlings by a stable bottle identifier makes repeat views predictable.
        if (left.bottle && right.bottle) {
            const inventories = (left.bottle.inventoryNumber || '').localeCompare(right.bottle.inventoryNumber || '', 'de', { numeric: true });
            if (inventories) return inventories;
            return left.bottle.id.localeCompare(right.bottle.id);
        }
        return a.id.localeCompare(b.id);
    });
    return entries;
}
