/** Presentation-only entries: one row per bottling or one row per physical bottle. */
import { bottleStatusLabels, whiskyTypeName } from './labels.js';
import { displayedTastingRating, latestTasting } from '../../../shared/tasting-records.js';

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

/** One rating range per Glencairn; the newest tasting is the sole source. */
export function matchesOverviewRating(bottling, filter = 'all') {
    if (filter === 'all') return true;
    const score = displayedTastingRating(bottling);
    if (filter === 'unrated') return score == null;
    const bucket = Number(filter);
    if (!Number.isInteger(bucket) || bucket < 1 || bucket > 5 || score == null || !Number.isFinite(Number(score))) return false;
    return Math.max(1, Math.ceil(Number(score) / 20)) === bucket;
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

/** All sort criteria use the underlying saved data, not formatted card labels. */
function purchasePrice(entry) {
    const bottles = entry.bottle ? [entry.bottle] : entry.bottling.bottles || [];
    const priced = bottles.filter(bottle => bottle.purchasePrice != null && bottle.purchasePrice !== ''
        && Number.isFinite(Number(bottle.purchasePrice)) && Number(bottle.purchasePrice) >= 0);
    if (!priced.length) return null;
    // Without exchange rates, cross-currency averages would be misleading.
    const currency = String(priced[0].currency || 'EUR').toUpperCase();
    if (priced.some(bottle => String(bottle.currency || 'EUR').toUpperCase() !== currency)) return null;
    return {currency, value:priced.reduce((total, bottle) => total + Number(bottle.purchasePrice), 0) / priced.length};
}

function latestUpdate(entry) {
    const times = [entry.bottling.updatedAt || entry.bottling.createdAt];
    if (entry.bottle) times.push(entry.bottle.updatedAt || entry.bottle.createdAt);
    else times.push(...(entry.bottling.bottles || []).map(bottle => bottle.updatedAt || bottle.createdAt));
    return times.filter(value => typeof value === 'string' && value.length).sort().at(-1) || null;
}

function comparePresent(left, right, descending = false) {
    // Blank dates, missing prices and unrated tastings always belong at the end.
    if (left == null) return right == null ? 0 : 1;
    if (right == null) return -1;
    const difference = typeof left === 'number' ? left - right : String(left).localeCompare(String(right), 'de', {numeric:true});
    return descending ? -difference : difference;
}

function compareEntries(left, right, sort, distilleryNames) {
    const a = left.bottling;
    const b = right.bottling;
    switch (sort) {
        case 'nameDesc': return b.name.localeCompare(a.name, 'de');
        case 'distillery': return String(distilleryNames(a)).localeCompare(String(distilleryNames(b)), 'de');
        case 'distilleryDesc': return String(distilleryNames(b)).localeCompare(String(distilleryNames(a)), 'de');
        case 'priceAsc':
        case 'priceDesc': {
            const x = purchasePrice(left), y = purchasePrice(right);
            if (!x || !y) return comparePresent(x, y);
            // Group currencies instead of silently comparing different monetary units.
            return comparePresent(x.currency, y.currency) || comparePresent(x.value, y.value, sort === 'priceDesc');
        }
        case 'scoreDesc': return comparePresent(displayedTastingRating(a), displayedTastingRating(b), true);
        case 'scoreAsc': return comparePresent(displayedTastingRating(a), displayedTastingRating(b));
        case 'updatedDesc': return comparePresent(latestUpdate(left), latestUpdate(right), true);
        case 'updatedAsc': return comparePresent(latestUpdate(left), latestUpdate(right));
        case 'tastedDesc': return comparePresent(latestTasting(a)?.tastedOn, latestTasting(b)?.tastedOn, true);
        case 'tastedAsc': return comparePresent(latestTasting(a)?.tastedOn, latestTasting(b)?.tastedOn);
        case 'newest': return comparePresent(left.bottle?.createdAt || a.createdAt, right.bottle?.createdAt || b.createdAt, true);
        case 'age': return comparePresent(a.ageYears, b.ageYears, true);
        case 'year': return comparePresent(a.releaseYear, b.releaseYear, true);
        default: return 0;
    }
}

/** Filter before slicing, so each physical bottle counts as its own result. */
export function collectionOverviewEntries(collection, {
    mode = 'bottlings', search = '', status = 'all', completion = 'all', sort = 'name',
    distillery = 'all', volumeType = 'all', rating = 'all', distilleryNames = () => '',
} = {}) {
    const needle = String(search).trim().toLocaleLowerCase('de');
    const entries = [];
    for (const bottling of collection.bottlings) {
        if (!matchesOverviewRating(bottling, rating)) continue;
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
        const difference = compareEntries(left, right, sort, distilleryNames);
        if (difference) return difference;
        const names = left.bottling.name.localeCompare(right.bottling.name, 'de');
        if (names) return names;
        // Sorting equal bottlings by a stable bottle identifier makes repeat views predictable.
        if (left.bottle && right.bottle) {
            const inventories = (left.bottle.inventoryNumber || '').localeCompare(right.bottle.inventoryNumber || '', 'de', { numeric: true });
            if (inventories) return inventories;
            return left.bottle.id.localeCompare(right.bottle.id);
        }
        return left.bottling.id.localeCompare(right.bottling.id);
    });
    return entries;
}
