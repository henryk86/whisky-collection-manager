import {validatePhotoAdjustments} from '../../public/js/features/photo-editor/adjustments.js';
/** Validate the complete JSON document before any write or import. No filesystem access. */
import { assert } from './errors.js';
import { allBottles, WHISKY_TYPES } from './collection.js';
import { normalizeTastingNotes, normalizeTastingRating } from '../../public/js/domain/tasting.js';
import { normalizeTastingRecord } from '../../public/js/domain/tasting-records.js';
import { normalizeStandaloneTasting } from '../../public/js/domain/standalone-tastings.js';
import {normalizeFlightFields,FLIGHT_LIMIT,allTastingReferences} from '../../public/js/domain/tasting-flights.js';
import { normalizeWhiskyColor } from '../../public/js/domain/whisky-colors.js';
import { isDocumentPath } from '../storage/documents.js';
const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
const isString = value => typeof value === 'string';
const optionalString = value => value == null || isString(value);
const isOptionalNumber = value => value == null || (typeof value === 'number' && Number.isFinite(value));
const validImagePath = p => typeof p === 'string' && /^images\/[a-f0-9-]{36}\/[\w-]+\.(jpg|png|webp|gif)$/i.test(p);
export function validate(collection) {
    assert(isObject(collection) && collection.schemaVersion === 4, 'Ungültige oder nicht unterstützte JSON-Schemaversion');
    assert(Array.isArray(collection.bottlings) && !Object.hasOwn(collection, 'bottles') && Array.isArray(collection.distilleries), 'Ungültige Sammlungsstruktur');
    assert(Number.isSafeInteger(collection.nextInventoryNumber) && collection.nextInventoryNumber > 0, 'Ungültiger Inventarnummern-Zähler');
    assert(Array.isArray(collection.reservedInventoryNumbers), 'Fehlende Liste reservierter Inventarnummern');
    // Settings are optional so older collection.json and backup ZIPs remain importable.
    if (collection.settings !== undefined) {
        assert(isObject(collection.settings), 'Ungültige Sammlungseinstellungen');
        const year = collection.settings.establishedYear;
        assert(year == null || (Number.isSafeInteger(year) && year >= 1600 && year <= new Date().getFullYear()),
            'Gründungsjahr muss zwischen 1600 und dem aktuellen Jahr liegen');
    }
    const distilleryIds = new Set(), bottlingIds = new Set(), bottleIds = new Set(), inventoryNumbers = new Set(), documentPaths = new Set();
    const distilleryNames = new Set();
    for (const distillery of collection.distilleries) {
        assert(isObject(distillery) && isString(distillery.id) && isString(distillery.name) && distillery.name.trim(), 'Ungültige Destillerie');
        assert(optionalString(distillery.country) && optionalString(distillery.region), 'Ungültige Destillerie-Herkunft');
        // Optional location data is additive; existing schema-v4 archives remain valid.
        const hasLat = distillery.latitude != null;
        const hasLon = distillery.longitude != null;
        assert(hasLat === hasLon, 'Destillerie benötigt beide Koordinaten');
        if (hasLat) {
            assert(typeof distillery.latitude === 'number' && Number.isFinite(distillery.latitude) && distillery.latitude >= -90 && distillery.latitude <= 90,
                'Ungültiger Breitengrad der Destillerie');
            assert(typeof distillery.longitude === 'number' && Number.isFinite(distillery.longitude) && distillery.longitude >= -180 && distillery.longitude <= 180,
                'Ungültiger Längengrad der Destillerie');
        }
        assert(!distilleryIds.has(distillery.id), 'Doppelte Destillerie-ID');
        assert(!distilleryNames.has(distillery.name.trim().toLowerCase()), 'Doppelter Destilleriename');
        distilleryIds.add(distillery.id);
        distilleryNames.add(distillery.name.trim().toLowerCase());
    }
    for (const bottling of collection.bottlings) {
        assert(isObject(bottling) && isString(bottling.id) && isString(bottling.name) && bottling.name.trim(), 'Ungültige Abfüllung');
        assert(!bottlingIds.has(bottling.id), 'Doppelte Abfüllungs-ID');
        assert(Array.isArray(bottling.bottles), 'Flaschenliste der Abfüllung fehlt');
        const ids = bottling.distilleryIds === undefined ? (bottling.distilleryId ? [bottling.distilleryId] : []) : bottling.distilleryIds;
        assert(Array.isArray(ids) && ids.every(x => isString(x) && distilleryIds.has(x)), 'Abfüllung referenziert unbekannte Destillerie');
        assert(new Set(ids).size === ids.length, 'Doppelte Destillerie innerhalb einer Abfüllung');
        assert(bottling.whiskyType == null || WHISKY_TYPES.includes(bottling.whiskyType), 'Ungültige Whisky-Kategorie');
        assert(optionalString(bottling.brand), 'Ungültige Marke');
        assert(!Object.hasOwn(bottling, 'volumeType'), 'Flaschentyp gehört zur physischen Flasche');
        assert(bottling.compositionComplete == null || typeof bottling.compositionComplete === 'boolean', 'Ungültiger Zusammensetzungsstatus');
        if (['single_malt', 'single_grain'].includes(bottling.whiskyType)) {
            assert(ids.length <= 1, 'Single Whisky darf nur eine Destillerie enthalten');
        }
        // Older collections may still contain legacy bottling.images before migration.
        if (bottling.images != null) {
            assert(isObject(bottling.images) && optionalString(bottling.images.bottle) && optionalString(bottling.images.box), 'Ungültige alte Bildreferenz');
            for (const p of [bottling.images.bottle, bottling.images.box].filter(Boolean)) {
                assert(validImagePath(p), 'Ungültiger alter Bildpfad');
            }
        }
        for (const field of ['ageYears', 'releaseYear', 'distillationYear', 'bottlingYear', 'abv', 'volumeMl', 'limitedEditionCount']) {
            assert(isOptionalNumber(bottling[field]), `Ungültige Zahl: ${field}`);
        }
        for (const field of ['distillationDate', 'bottlingDate']) {
            if (bottling[field] != null) {
                assert(isString(bottling[field]) && /^\d{4}-\d{2}-\d{2}$/.test(bottling[field]), `Ungültiges Datum: ${field}`);
                const parsedDate = new Date(bottling[field] + 'T00:00:00Z');
                assert(!Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === bottling[field], `Ungültiges Datum: ${field}`);
                const yearField = field === 'distillationDate' ? 'distillationYear' : 'bottlingYear';
                assert(bottling[yearField] == null || bottling[yearField] === Number(bottling[field].slice(0, 4)), `${field} widerspricht ${yearField}`);
            }
        }
        if (bottling.tastings !== undefined) {
            assert(Array.isArray(bottling.tastings), 'Ungültige Verkostungsliste');
            const tastingIds=new Set();
            for (const tasting of bottling.tastings) {
                assert(isObject(tasting) && isString(tasting.id) && /^[a-zA-Z0-9-]{1,100}$/.test(tasting.id) &&
                    isString(tasting.createdAt) && !Number.isNaN(Date.parse(tasting.createdAt)) &&
                    isString(tasting.updatedAt) && !Number.isNaN(Date.parse(tasting.updatedAt)), 'Ungültige Verkostungsmetadaten');
                assert(!tastingIds.has(tasting.id),'Doppelte Verkostungs-ID');
                tastingIds.add(tasting.id);
                const {id,createdAt,updatedAt,...editable}=tasting;
                try { normalizeTastingRecord(editable); }
                catch { assert(false,'Ungültiger Verkostungseintrag'); }
            }
        }
        if (bottling.tastingNotes !== undefined) {
            try { normalizeTastingNotes(bottling.tastingNotes); }
            catch { assert(false, 'Ungültige Abfüllungs-Verkostungsnotizen'); }
        }
        if (bottling.rating !== undefined) {
            try { normalizeTastingRating(bottling.rating); }
            catch { assert(false, 'Ungültige Abfüllungsbewertung'); }
        }
        if (bottling.whiskyColor !== undefined) {
            try { normalizeWhiskyColor(bottling.whiskyColor); }
            catch { assert(false, 'Ungültige Whiskyfarbe'); }
        }
        if (bottling.legacyTastings !== undefined) {
            assert(Array.isArray(bottling.legacyTastings), 'Ungültige ehemalige Flaschenbewertungen');
            for (const entry of bottling.legacyTastings) {
                assert(isObject(entry) && isString(entry.bottleId) && optionalString(entry.inventoryNumber), 'Ungültiger Eintrag früherer Verkostungen');
                try { normalizeTastingNotes(entry.tastingNotes); normalizeTastingRating(entry.rating); }
                catch { assert(false, 'Ungültiger früherer Verkostungseintrag'); }
            }
        }
        bottlingIds.add(bottling.id);
    }
    if (collection.externalTastings !== undefined) {
        assert(Array.isArray(collection.externalTastings), 'Ungültige externe Verkostungsliste');
        const ids = new Set();
        for (const record of collection.externalTastings) {
            assert(isObject(record) && isString(record.id) && /^[a-zA-Z0-9-]{1,100}$/.test(record.id) &&
                !ids.has(record.id) &&
                isString(record.createdAt) && !Number.isNaN(Date.parse(record.createdAt)) &&
                isString(record.updatedAt) && !Number.isNaN(Date.parse(record.updatedAt)), 'Ungültige externe Verkostungsmetadaten');
            ids.add(record.id);
            assert(Object.keys(record).every(k=>['id','createdAt','updatedAt','bottling','tastedOn','title','flavorProfile','tastingNotes','rating','whiskyColor'].includes(k)),
                'Unbekanntes externes Verkostungsfeld');
            const {id,createdAt,updatedAt,...editable} = record;
            try { normalizeStandaloneTasting(editable); }
            catch { assert(false, 'Ungültige externe Verkostungsdaten'); }
        }
    }
    // Flights are optional so existing schema-v4 collections/backups remain valid.
    if (collection.tastingFlights !== undefined) {
        assert(Array.isArray(collection.tastingFlights), 'Ungültige Flight-Liste');
        const flights=new Set(),assigned=new Set(),known=allTastingReferences(collection);
        for (const flight of collection.tastingFlights) {
            assert(isObject(flight) && isString(flight.id) && /^[a-zA-Z0-9-]{1,100}$/.test(flight.id) &&
                !flights.has(flight.id) && isString(flight.createdAt) && !Number.isNaN(Date.parse(flight.createdAt)) &&
                isString(flight.updatedAt) && !Number.isNaN(Date.parse(flight.updatedAt)), 'Ungültige Flight-Metadaten');
            flights.add(flight.id);
            assert(Object.keys(flight).every(k=>['id','name','date','notes','tastingIds','createdAt','updatedAt'].includes(k)), 'Unbekanntes Flight-Feld');
            try { normalizeFlightFields({name:flight.name,date:flight.date,notes:flight.notes}); }
            catch { assert(false,'Ungültiger Flight'); }
            assert(Array.isArray(flight.tastingIds) && flight.tastingIds.length<=FLIGHT_LIMIT, 'Ungültige Flight-Reihenfolge');
            for (const id of flight.tastingIds) {
                assert(isString(id) && /^[a-zA-Z0-9-]{1,100}$/.test(id) && !assigned.has(id) &&
                    known.filter(item=>item.record.id===id).length===1, 'Flight-Verkostung fehlt oder ist mehrfach zugeordnet');
                assigned.add(id);
            }
        }
    }
    for (const bottle of allBottles(collection)) {
        assert(isObject(bottle) && isString(bottle.id) && !Object.hasOwn(bottle, 'bottlingId'), 'Ungültige verschachtelte Flasche');
        assert(!bottleIds.has(bottle.id), 'Doppelte Flaschen-ID');
        assert(['closed', 'open', 'empty'].includes(bottle.status), 'Ungültiger Flaschenstatus');
        assert(['standard', 'sample'].includes(bottle.volumeType), 'Ungültiger Flaschentyp der physischen Flasche');
        assert(bottle.volumeMl == null || (isOptionalNumber(bottle.volumeMl) && bottle.volumeMl > 0 && bottle.volumeMl <= 100000), 'Ungültige Größe der physischen Flasche');
        assert(optionalString(bottle.inventoryNumber), 'Ungültige Inventarnummer');
        assert(!Object.hasOwn(bottle, 'labelCode'), 'Etikettencode ist kein separates Feld mehr');
        assert(!Object.hasOwn(bottle, 'labelType'), 'Der Etikettentyp wird nicht gespeichert');
        assert(bottle.photos === undefined || Array.isArray(bottle.photos), 'Ungültige Fotoliste');
        const photoIds = new Set(), photoPaths = new Set();
        for (const photo of bottle.photos || []) {
            assert(isObject(photo) && isString(photo.id) && validImagePath(photo.path), 'Ungültiges Flaschenfoto');
            assert(photo.source === undefined || photo.source === 'whiskybase', 'Unbekannte Fotoquelle');
            if (photo.cutout !== undefined) {
                const cutout = photo.cutout;
                assert(isObject(cutout) && validImagePath(cutout.path) &&
                    cutout.path.startsWith(`images/${bottle.id}/`) &&
                    cutout.path.endsWith('.png') && cutout.path !== photo.path &&
                    cutout.model === 'u2netp-v1' && typeof cutout.selected === 'boolean',
                'Ungültige Freistellung');
                assert(!photoPaths.has(cutout.path), 'Doppelte Freistellung');
                photoPaths.add(cutout.path);
            }
            const verifyAdjustment = (edit, expectedSource) => {
                assert(isObject(edit) && validImagePath(edit.path) &&
                    edit.path.startsWith(`images/${bottle.id}/`) && edit.path.endsWith('.webp') &&
                    edit.path !== photo.path && edit.path !== photo.cutout?.path &&
                    edit.sourcePath === expectedSource,
                'Ungültige Bildkorrektur');
                try { validatePhotoAdjustments(edit.settings); }
                catch { assert(false, 'Ungültige Bildkorrekturwerte'); }
                assert(!photoPaths.has(edit.path), 'Doppelte Bildkorrektur');
                photoPaths.add(edit.path);
            };
            if (photo.adjustment !== undefined) {
                // Old v0.17.x datasets could reference either base; new edits
                // on selected cutouts are stored within cutout.adjustment.
                assert(photo.adjustment.sourcePath === photo.path ||
                    photo.adjustment.sourcePath === photo.cutout?.path, 'Ungültige Bildquelle');
                verifyAdjustment(photo.adjustment, photo.adjustment.sourcePath);
            }
            if (photo.cutout?.adjustment !== undefined)
                verifyAdjustment(photo.cutout.adjustment, photo.cutout.path);
            assert(!photoIds.has(photo.id) && !photoPaths.has(photo.path), 'Doppeltes Flaschenfoto');
            photoIds.add(photo.id);
            photoPaths.add(photo.path);
        }
        assert(bottle.files === undefined || Array.isArray(bottle.files), 'Ungueltige Dateiliste');
        const fileIds = new Set();
        for (const file of bottle.files || []) {
            assert(isObject(file) && isString(file.id) && /^[a-f0-9-]{36}$/i.test(file.id)
                && isDocumentPath(file.path, bottle.id), 'Ungueltiger Dateianhang');
            assert(isString(file.name) && file.name.length > 0 && file.name.length <= 180
                && !/[\\/\x00-\x1f\x7f]/.test(file.name), 'Ungueltiger Anhangname');
            assert(Number.isSafeInteger(file.size) && file.size > 0, 'Ungueltige Anhanggroesse');
            assert(isString(file.mimeType) && file.mimeType.length < 150, 'Ungueltiger Anhangtyp');
            assert(isString(file.sha256) && /^[a-f0-9]{64}$/i.test(file.sha256), 'Ungueltiger Datei-Pruefwert');
            assert(isString(file.uploadedAt) && !Number.isNaN(Date.parse(file.uploadedAt)), 'Ungueltiges Upload-Datum');
            assert(!fileIds.has(file.id) && !documentPaths.has(file.path), 'Doppelter Dateianhang');
            fileIds.add(file.id);
            documentPaths.add(file.path);
        }
        if (bottle.inventoryNumber) {
            assert(!inventoryNumbers.has(bottle.inventoryNumber), 'Inventarnummer bereits vergeben', 409);
            inventoryNumbers.add(bottle.inventoryNumber);
        }
        bottleIds.add(bottle.id);
    }
    assert(new Set(collection.reservedInventoryNumbers).size === collection.reservedInventoryNumbers.length, 'Doppelte reservierte Inventarnummern');
    for (const n of collection.reservedInventoryNumbers) {
        assert(isString(n) && n, 'Ungültige reservierte Inventarnummer');
    }
    return collection;
}
export function requireField(value, name) {
    assert(isString(value) && value.trim(), `${name} ist erforderlich`);
    return value.trim();
}
