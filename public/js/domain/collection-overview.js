/** Presentation-only entries: one row per bottling or one row per physical bottle. */
import { bottleStatusLabels, whiskyTypeName } from './labels.js';
import { displayedTastingRating, latestTasting, sortedTastings } from '../../../shared/tasting-records.js';
import {normalizeFlavorCriteria} from '../../../shared/collection-saved-views.js';

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
export function purchasePrice(entry) {
    const bottles = entry.bottle ? [entry.bottle] : entry.bottling.bottles || [];
    const priced = bottles.filter(bottle => bottle.purchasePrice != null && bottle.purchasePrice !== ''
        && Number.isFinite(Number(bottle.purchasePrice)) && Number(bottle.purchasePrice) >= 0);
    if (!priced.length) return null;
    // Without exchange rates, cross-currency averages would be misleading.
    const currency = String(priced[0].currency || 'EUR').toUpperCase();
    if (priced.some(bottle => String(bottle.currency || 'EUR').toUpperCase() !== currency)) return null;
    return {currency, value:priced.reduce((total, bottle) => total + Number(bottle.purchasePrice), 0) / priced.length};
}

export function latestUpdate(entry) {
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

function asNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

const STATUS_ORDER = Object.freeze({closed:0,open:1,empty:2});

function compareEntries(left, right, sort, distilleryNames) {
    const a = left.bottling;
    const b = right.bottling;
    switch (sort) {
        case 'nameDesc': return b.name.localeCompare(a.name, 'de');
        case 'inventoryAsc': return comparePresent(left.bottle?.inventoryNumber || null, right.bottle?.inventoryNumber || null);
        case 'inventoryDesc': return comparePresent(left.bottle?.inventoryNumber || null, right.bottle?.inventoryNumber || null, true);
        case 'ageAsc': return comparePresent(asNumber(a.ageYears), asNumber(b.ageYears));
        case 'abvAsc': return comparePresent(asNumber(a.abv), asNumber(b.abv));
        case 'abvDesc': return comparePresent(asNumber(a.abv), asNumber(b.abv), true);
        case 'yearAsc': return comparePresent(asNumber(a.releaseYear), asNumber(b.releaseYear));
        case 'stockAsc': return comparePresent(a.bottles?.length || 0, b.bottles?.length || 0);
        case 'stockDesc': return comparePresent(a.bottles?.length || 0, b.bottles?.length || 0, true);
        case 'completionAsc': return comparePresent(a.completionStatus, b.completionStatus);
        case 'completionDesc': return comparePresent(a.completionStatus, b.completionStatus, true);
        case 'statusAsc': return comparePresent(STATUS_ORDER[left.bottle?.status] ?? null, STATUS_ORDER[right.bottle?.status] ?? null);
        case 'statusDesc': return comparePresent(STATUS_ORDER[left.bottle?.status] ?? null, STATUS_ORDER[right.bottle?.status] ?? null, true);
        case 'volumeTypeAsc': return comparePresent(left.bottle?.volumeType || 'standard', right.bottle?.volumeType || 'standard');
        case 'volumeTypeDesc': return comparePresent(left.bottle?.volumeType || 'standard', right.bottle?.volumeType || 'standard', true);
        case 'volumeMlAsc': return comparePresent(asNumber(left.bottle?.volumeMl), asNumber(right.bottle?.volumeMl));
        case 'volumeMlDesc': return comparePresent(asNumber(left.bottle?.volumeMl), asNumber(right.bottle?.volumeMl), true);
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
        case 'age': return comparePresent(asNumber(a.ageYears), asNumber(b.ageYears), true);
        case 'year': return comparePresent(asNumber(a.releaseYear), asNumber(b.releaseYear), true);
        default: return 0;
    }
}

/** Criteria refer to the newest tasting only; missing axes are not equivalent to zero. */
export function matchesFlavorCriteria(bottling, criteria = [], profileMissing = false, profilePresent = false) {
    const profile = sortedTastings(bottling).find(item => item.flavorProfile)?.flavorProfile || null;
    if (profileMissing) return !profile;
    if (profilePresent && !profile) return false;
    const rules = normalizeFlavorCriteria(criteria);
    if (!rules.length) return true;
    return rules.every(({axis,min,max}) => typeof profile?.[axis] === 'number' &&
        profile[axis] >= min && profile[axis] <= max);
}

/** Filter before slicing, so each physical bottle counts as its own result. */
export function collectionOverviewEntries(collection, {
    mode = 'bottlings', search = '', status = 'all', completion = 'all', sort = 'name',
    distillery = 'all', volumeType = 'all', rating = 'all', flavorCriteria = [], profileMissing = false, profilePresent = false, distilleryNames = () => '',
} = {}) {
    const needle = String(search).trim().toLocaleLowerCase('de');
    const entries = [];
    for (const bottling of collection.bottlings) {
        if (!matchesOverviewRating(bottling, rating) || !matchesFlavorCriteria(bottling,flavorCriteria,profileMissing,profilePresent)) continue;
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
