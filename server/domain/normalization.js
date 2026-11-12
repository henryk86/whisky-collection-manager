/** Only explicitly writable fields reach the collection; IDs and photos cannot be patched. */
import { fail } from './errors.js';
import { requireField } from './validation.js';
import { WHISKY_TYPES } from './collection.js';
const fields = ['name', 'distilleryIds', 'distilleryId', 'whiskyType', 'brand', 'compositionComplete', 'bottler', 'ageYears', 'releaseYear', 'distillationYear', 'bottlingYear', 'distillationDate', 'bottlingDate', 'abv', 'volumeMl', 'caskType', 'caskNumber', 'limitedEditionCount', 'country', 'region', 'whiskybaseUrl', 'whiskybaseId', 'description', 'completionStatus'];
const bottleFields = ['inventoryNumber', 'volumeType', 'volumeMl', 'status', 'purchaseDate', 'purchasePrice', 'currency', 'merchant', 'openedAt', 'comment', 'tastingNotes', 'rating'];
function filtered(source, keys) {
    const obj = {};
    for (const k of keys) {
        if (Object.hasOwn(source, k)) {
            obj[k] = source[k];
        }
    }
    return obj;
}
export function normalizeBottling(input, old = {}) {
    if (Object.hasOwn(input, 'volumeType')) {
        throw fail('Der Flaschentyp gehört zu einer physischen Flasche, nicht zur Abfüllung');
    }
    const value = {
        ...old, ...filtered(input, fields)
    };
    value.name = requireField(value.name, 'Whiskyname');
    if (Object.hasOwn(input, 'distilleryIds')) {
        if (!Array.isArray(input.distilleryIds)) {
            throw fail('Destillerien müssen eine Liste sein');
        }
        value.distilleryIds = input.distilleryIds;
    }
    else if (Object.hasOwn(input, 'distilleryId')) {
        value.distilleryIds = input.distilleryId ? [input.distilleryId] : [];
    }
    else if (!Array.isArray(value.distilleryIds)) {
        value.distilleryIds = value.distilleryId ? [value.distilleryId] : [];
    }
    delete value.distilleryId;
    if (value.whiskyType === '') {
        value.whiskyType = null;
    }
    if (value.whiskyType != null && !WHISKY_TYPES.includes(value.whiskyType)) {
        throw fail('Ungültige Whisky-Kategorie');
    }
    if (value.brand === '') {
        value.brand = null;
    }
    if (value.compositionComplete == null) {
        value.compositionComplete = false;
    }
    if (typeof value.compositionComplete !== 'boolean') {
        throw fail('Ungültiger Zusammensetzungsstatus');
    }
    if (['single_malt', 'single_grain'].includes(value.whiskyType) && value.distilleryIds.length > 1) {
        throw fail('Für Single Whisky darf maximal eine Destillerie gewählt werden');
    }
    for (const k of ['ageYears', 'releaseYear', 'distillationYear', 'bottlingYear', 'distillationDate', 'bottlingDate', 'abv', 'volumeMl', 'limitedEditionCount']) {
        if (value[k] === '') {
            value[k] = null;
        }
    }
    for (const [dateField, yearField] of [['distillationDate', 'distillationYear'], ['bottlingDate', 'bottlingYear']]) {
        if (value[dateField] === '') {
            value[dateField] = null;
        }
        if (value[dateField]) {
            value[yearField] = Number(value[dateField].slice(0, 4));
        }
    }
    value.completionStatus = value.completionStatus === 'complete' ? 'complete' : 'incomplete';
    return value;
}
export function normalizeBottle(input, old = {}) {
    if (Object.hasOwn(input, 'labelCode')) {
        throw fail('Nur Inventarnummer verwenden; separates Feld Etikettencode wurde entfernt. Bitte Anwendung aktualisieren.');
    }
    const val = {
        ...old, ...filtered(input, bottleFields)
    };
    val.status = ['closed', 'open', 'empty'].includes(val.status) ? val.status : 'closed';
    if (val.volumeType != null && !['sample', 'standard'].includes(val.volumeType)) {
        throw fail('Ungültiger Flaschentyp');
    }
    val.volumeType = val.volumeType || 'standard';
    if (val.volumeMl === '' || val.volumeMl === undefined) val.volumeMl = null;
    if (val.volumeMl != null) {
        if (!Number.isFinite(Number(val.volumeMl)) || Number(val.volumeMl) <= 0 || Number(val.volumeMl) > 100000) {
            throw fail('Ungültige Flaschengröße (ml)');
        }
        val.volumeMl = Number(val.volumeMl);
    }
    val.inventoryNumber = String(val.inventoryNumber ?? '').trim();
    delete val.labelType;
    if (val.purchasePrice === '') {
        val.purchasePrice = null;
    }
    if (val.rating === '') {
        val.rating = null;
    }
    if (val.purchasePrice != null && (!Number.isFinite(Number(val.purchasePrice)) || Number(val.purchasePrice) < 0)) {
        throw fail('Ungültiger Kaufpreis');
    }
    if (val.rating != null && (!Number.isFinite(Number(val.rating)) || Number(val.rating) < 0 || Number(val.rating) > 100)) {
        throw fail('Bewertung muss zwischen 0 und 100 liegen');
    }
    return val;
}
