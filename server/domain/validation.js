import {validateAdjustmentValues as validatePhotoAdjustments} from '../../shared/photo-adjustments.js';
/** Validate the complete JSON document before any write or import. No filesystem access. */
import {assert} from './errors.js';
import {allBottles, WHISKY_TYPES} from './collection.js';
import {normalizeTastingRecord} from '../../shared/tasting-records.js';
import {normalizeStandaloneTasting} from '../../shared/standalone-tastings.js';
import {normalizeFlightFields, FLIGHT_LIMIT, allTastingReferences, validateFlightPlan} from '../../shared/tasting-flights.js';
import {normalizeSavedViews} from '../../shared/collection-saved-views.js';
import {isDocumentPath} from '../storage/documents.js';
const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
const isString = value => typeof value === 'string';
const optionalString = value => value == null || isString(value);
const isOptionalNumber = value => value == null || (typeof value === 'number' && Number.isFinite(value));
const validDay = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number(value.slice(0, 4)) >= 1600 && Number(value.slice(0, 4)) <= 2300 &&
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const validImagePath = p => typeof p === 'string' && /^images\/[a-f0-9-]{36}\/[\w-]+\.(jpg|png|webp|gif)$/i.test(p);
export function validate(collection) {
  assert(isObject(collection) && collection.schemaVersion === 6, 'Ungültige oder nicht unterstützte JSON-Schemaversion', 400, "api.errors.invalidOrUnsupportedJSONSchemaVersion");
  assert(Array.isArray(collection.bottlings) && !Object.hasOwn(collection, 'bottles') && Array.isArray(collection.distilleries), 'Ungültige Sammlungsstruktur', 400, "api.errors.invalidCollectionStructure");
  assert(Number.isSafeInteger(collection.nextInventoryNumber) && collection.nextInventoryNumber > 0, 'Ungültiger Inventarnummern-Zähler', 400, "api.errors.invalidInventoryNumberCounter");
  assert(Array.isArray(collection.reservedInventoryNumbers), 'Fehlende Liste reservierter Inventarnummern', 400, "api.errors.missingListOfReservedInventoryNumbers");
  // Current collection settings only.
  if (collection.settings !== undefined) {
    assert(isObject(collection.settings), 'Ungültige Sammlungseinstellungen', 400, "api.errors.invalidCollectionSettings");
    if (collection.settings.savedViews !== undefined) {
      try {normalizeSavedViews(collection.settings.savedViews);}
      catch {assert(false, 'Ungültige gespeicherte Ansichten', 400, 'api.errors.invalidCollectionSettings');}
    }
    const year = collection.settings.establishedYear;
    assert(year == null || (Number.isSafeInteger(year) && year >= 1600 && year <= new Date().getFullYear()), 'Gründungsjahr muss zwischen 1600 und dem aktuellen Jahr liegen', 400, "api.errors.foundingYearMustBeBetween1600AndTheCurrentYear");
  }
  const distilleryIds = new Set(), bottlingIds = new Set(), bottleIds = new Set(), inventoryNumbers = new Set(), documentPaths = new Set();
  const distilleryNames = new Set();
  for (const distillery of collection.distilleries) {
    assert(isObject(distillery) && isString(distillery.id) && isString(distillery.name) && distillery.name.trim(), 'Ungültige Destillerie', 400, "api.errors.invalidDistillery");
    assert(optionalString(distillery.country) && optionalString(distillery.region), 'Ungültige Destillerie-Herkunft', 400, "api.errors.invalidDistilleryOrigin");
    // Optional site location data.
    const hasLat = distillery.latitude != null;
    const hasLon = distillery.longitude != null;
    assert(hasLat === hasLon, 'Destillerie benötigt beide Koordinaten', 400, "api.errors.distilleryRequiresBothCoordinates");
    if (hasLat) {
      assert(typeof distillery.latitude === 'number' && Number.isFinite(distillery.latitude) && distillery.latitude >= -90 && distillery.latitude <= 90, 'Ungültiger Breitengrad der Destillerie', 400, "api.errors.invalidDistilleryLatitude");
      assert(typeof distillery.longitude === 'number' && Number.isFinite(distillery.longitude) && distillery.longitude >= -180 && distillery.longitude <= 180, 'Ungültiger Längengrad der Destillerie', 400, "api.errors.invalidDistilleryLongitude");
    }
    assert(!distilleryIds.has(distillery.id), 'Doppelte Destillerie-ID', 400, "api.errors.duplicateDistilleryID");
    assert(!distilleryNames.has(distillery.name.trim().toLowerCase()), 'Doppelter Destilleriename', 400, "api.errors.duplicateDistilleryName");
    distilleryIds.add(distillery.id);
    distilleryNames.add(distillery.name.trim().toLowerCase());
  }
  for (const bottling of collection.bottlings) {
    assert(isObject(bottling) && isString(bottling.id) && isString(bottling.name) && bottling.name.trim(), 'Ungültige Abfüllung', 400, "api.errors.invalidBottling");
    assert(!bottlingIds.has(bottling.id), 'Doppelte Abfüllungs-ID', 400, "api.errors.duplicateBottlingID");
    assert(Array.isArray(bottling.bottles), 'Flaschenliste der Abfüllung fehlt', 400, "api.errors.bottlingBottleListIsMissing");
    const ids = bottling.distilleryIds === undefined ? (bottling.distilleryId ? [bottling.distilleryId] : []) : bottling.distilleryIds;
    assert(Array.isArray(ids) && ids.every(x => isString(x) && distilleryIds.has(x)), 'Abfüllung referenziert unbekannte Destillerie', 400, "api.errors.bottlingReferencesAnUnknownDistillery");
    assert(new Set(ids).size === ids.length, 'Doppelte Destillerie innerhalb einer Abfüllung', 400, "api.errors.duplicateDistilleryWithinABottling");
    assert(bottling.whiskyType == null || WHISKY_TYPES.includes(bottling.whiskyType), 'Ungültige Whisky-Kategorie', 400, "api.errors.invalidWhiskyCategory");
    assert(optionalString(bottling.brand), 'Ungültige Marke', 400, "api.errors.invalidBrand");
    assert(!Object.hasOwn(bottling, 'volumeType'), 'Flaschentyp gehört zur physischen Flasche', 400, "api.errors.bottleTypeOnPhysicalBottle");
    assert(bottling.compositionComplete == null || typeof bottling.compositionComplete === 'boolean', 'Ungültiger Zusammensetzungsstatus', 400, "api.errors.invalidCompositionStatus");
    if (['single_malt', 'single_grain'].includes(bottling.whiskyType)) {
      assert(ids.length <= 1, 'Single Whisky darf nur eine Destillerie enthalten', 400, "api.errors.singleWhiskyMayContainOnlyOneDistillery");
    }
    // Older image references are accepted within current-schema documents until image cleanup.
    if (bottling.images != null) {
      assert(isObject(bottling.images) && optionalString(bottling.images.bottle) && optionalString(bottling.images.box), 'Ungültige alte Bildreferenz', 400, "api.errors.invalidLegacyImageReference");
      for (const p of [bottling.images.bottle, bottling.images.box].filter(Boolean)) {
        assert(validImagePath(p), 'Ungültiger alter Bildpfad', 400, "api.errors.invalidLegacyImagePath");
      }
    }
    for (const field of ['ageYears', 'releaseYear', 'distillationYear', 'bottlingYear', 'abv', 'volumeMl', 'limitedEditionCount']) {
      assert(isOptionalNumber(bottling[field]), `Ungültige Zahl: ${field}`, 400, "api.errors.invalidNumberField", {field});
    }
    for (const field of ['distillationDate', 'bottlingDate']) {
      if (bottling[field] != null) {
        assert(isString(bottling[field]) && /^\d{4}-\d{2}-\d{2}$/.test(bottling[field]), `Ungültiges Datum: ${field}`, 400, "api.errors.invalidDateField", {field});
        const parsedDate = new Date(bottling[field] + 'T00:00:00Z');
        assert(!Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === bottling[field], `Ungültiges Datum: ${field}`, 400, "api.errors.invalidDateField", {field});
        const yearField = field === 'distillationDate' ? 'distillationYear' : 'bottlingYear';
        assert(bottling[yearField] == null || bottling[yearField] === Number(bottling[field].slice(0, 4)), `${field} widerspricht ${yearField}`, 400, "api.errors.conflictingFields", {field, other: yearField});
      }
    }
    {
      assert(Array.isArray(bottling.tastings), 'Ungültige Verkostungsliste', 400, "api.errors.invalidTastingList");
      const tastingIds = new Set();
      for (const tasting of bottling.tastings) {
        assert(isObject(tasting) && isString(tasting.id) && /^[a-zA-Z0-9-]{1,100}$/.test(tasting.id) &&
          isString(tasting.createdAt) && !Number.isNaN(Date.parse(tasting.createdAt)) &&
          isString(tasting.updatedAt) && !Number.isNaN(Date.parse(tasting.updatedAt)), 'Ungültige Verkostungsmetadaten', 400, "api.errors.invalidTastingMetadata");
        assert(!tastingIds.has(tasting.id), 'Doppelte Verkostungs-ID', 400, "api.errors.duplicateTastingID");
        tastingIds.add(tasting.id);
        const {id, createdAt, updatedAt, ...editable} = tasting;
        try {normalizeTastingRecord(editable);}
        catch {assert(false, 'Ungültiger Verkostungseintrag', 400, "api.errors.invalidTastingEntry");}
      }
    }
    assert(!['rating', 'tastingNotes', 'flavorProfile', 'whiskyColor', 'legacyTastings'].some(key =>
      Object.hasOwn(bottling, key)), 'Verkostungsdaten gehören ausschließlich in tastings', 400, "api.errors.tastingDataOnlyInTastings");
    bottlingIds.add(bottling.id);
  }
  {
    assert(Array.isArray(collection.externalTastings), 'Ungültige externe Verkostungsliste', 400, "api.errors.invalidExternalTastingList");
    const ids = new Set();
    for (const record of collection.externalTastings) {
      assert(isObject(record) && isString(record.id) && /^[a-zA-Z0-9-]{1,100}$/.test(record.id) &&
        !ids.has(record.id) &&
        isString(record.createdAt) && !Number.isNaN(Date.parse(record.createdAt)) &&
        isString(record.updatedAt) && !Number.isNaN(Date.parse(record.updatedAt)), 'Ungültige externe Verkostungsmetadaten', 400, "api.errors.invalidExternalTastingMetadata");
      ids.add(record.id);
      assert(Object.keys(record).every(k => ['id', 'createdAt', 'updatedAt', 'bottling', 'tastedOn', 'title', 'flavorProfile', 'tastingNotes', 'rating', 'ratingComment', 'whiskyColor'].includes(k)), 'Unbekanntes externes Verkostungsfeld', 400, "api.errors.unknownExternalTastingField");
      const {id, createdAt, updatedAt, ...editable} = record;
      try {normalizeStandaloneTasting(editable);}
      catch {assert(false, 'Ungültige externe Verkostungsdaten', 400, "api.errors.invalidExternalTastingData");}
    }
  }
  {
    assert(Array.isArray(collection.tastingFlights), 'Ungültige Flight-Liste', 400, "api.errors.invalidFlightList");
    const flights = new Set(), assigned = new Set(), referenceCount = new Map();
    // Count once instead of filtering all references for every flight member (was O(n²)).
    for (const item of allTastingReferences(collection)) referenceCount.set(item.record.id, (referenceCount.get(item.record.id) || 0) + 1);
    for (const flight of collection.tastingFlights) {
      assert(isObject(flight) && isString(flight.id) && /^[a-zA-Z0-9-]{1,100}$/.test(flight.id) &&
        !flights.has(flight.id) && isString(flight.createdAt) && !Number.isNaN(Date.parse(flight.createdAt)) &&
        isString(flight.updatedAt) && !Number.isNaN(Date.parse(flight.updatedAt)), 'Ungültige Flight-Metadaten', 400, "api.errors.invalidFlightMetadata");
      flights.add(flight.id);
      assert(Object.keys(flight).every(k => ['id', 'name', 'date', 'notes', 'tastingIds', 'createdAt', 'updatedAt', 'phase', 'planItems'].includes(k)), 'Unbekanntes Flight-Feld', 400, "api.errors.unknownFlightField");
      try {normalizeFlightFields({name: flight.name, date: flight.date, notes: flight.notes});}
      catch {assert(false, 'Ungültiger Flight', 400, "api.errors.invalidFlight");}
      try {validateFlightPlan(collection, flight);}
      catch {assert(false, 'Ungültige Flight-Planung', 400, 'api.errors.invalidFlight');}
      assert(Array.isArray(flight.tastingIds) && flight.tastingIds.length <= FLIGHT_LIMIT, 'Ungültige Flight-Reihenfolge', 400, "api.errors.invalidFlightOrder");
      for (const id of flight.tastingIds) {
        assert(isString(id) && /^[a-zA-Z0-9-]{1,100}$/.test(id) && !assigned.has(id) &&
          referenceCount.get(id) === 1, 'Flight-Verkostung fehlt oder ist mehrfach zugeordnet', 400, "api.errors.flightTastingMissingOrDuplicate");
        assigned.add(id);
      }
    }
  }
  for (const bottle of allBottles(collection)) {
    assert(isObject(bottle) && isString(bottle.id) && !Object.hasOwn(bottle, 'bottlingId'), 'Ungültige verschachtelte Flasche', 400, "api.errors.invalidNestedBottle");
    assert(!bottleIds.has(bottle.id), 'Doppelte Flaschen-ID', 400, "api.errors.duplicateBottleID");
    assert(['closed', 'open', 'empty'].includes(bottle.status), 'Ungültiger Flaschenstatus', 400, "api.errors.invalidBottleStatus");
    assert(['standard', 'sample'].includes(bottle.volumeType), 'Ungültiger Flaschentyp der physischen Flasche', 400, "api.errors.invalidPhysicalBottleType");
    assert(bottle.volumeMl == null || (isOptionalNumber(bottle.volumeMl) && bottle.volumeMl > 0 && bottle.volumeMl <= 100000), 'Ungültige Größe der physischen Flasche', 400, "api.errors.invalidPhysicalBottleSize");
    assert(optionalString(bottle.inventoryNumber), 'Ungültige Inventarnummer', 400, "api.errors.invalidInventoryNumber");
    if (bottle.emptiedAt != null && bottle.emptiedAt !== '') {
      assert(validDay(bottle.emptiedAt), 'Ungültiges Leerdatum', 400, 'api.errors.invalidBottleEmptyDate');
      // A same-day opening/emptying is valid (0 days). An impossible order is not.
      if (validDay(bottle.openedAt)) {
        assert(bottle.emptiedAt >= bottle.openedAt, 'Leerdatum liegt vor dem Öffnungsdatum', 400,
          'api.errors.emptyDateBeforeOpening');
      }
    }
    assert(!Object.hasOwn(bottle, 'labelCode'), 'Etikettencode ist kein separates Feld mehr', 400, "api.errors.labelCodeNoLongerSeparate");
    assert(!Object.hasOwn(bottle, 'labelType'), 'Der Etikettentyp wird nicht gespeichert', 400, "api.errors.labelTypeNotStored");
    assert(bottle.photos === undefined || Array.isArray(bottle.photos), 'Ungültige Fotoliste', 400, "api.errors.invalidPhotoList");
    const photoIds = new Set(), photoPaths = new Set();
    for (const photo of bottle.photos || []) {
      assert(isObject(photo) && isString(photo.id) && validImagePath(photo.path), 'Ungültiges Flaschenfoto', 400, "api.errors.invalidBottlePhoto");
      assert(photo.source === undefined || photo.source === 'whiskybase', 'Unbekannte Fotoquelle', 400, "api.errors.unknownPhotoSource");
      if (photo.cutout !== undefined) {
        const cutout = photo.cutout;
        assert(isObject(cutout) && validImagePath(cutout.path) &&
          cutout.path.startsWith(`images/${bottle.id}/`) &&
          cutout.path.endsWith('.png') && cutout.path !== photo.path &&
          cutout.model === 'u2netp-v1' && typeof cutout.selected === 'boolean', 'Ungültige Freistellung', 400, "api.errors.invalidCutout");
        assert(!photoPaths.has(cutout.path), 'Doppelte Freistellung', 400, "api.errors.duplicateBackgroundRemoval");
        photoPaths.add(cutout.path);
      }
      const verifyAdjustment = (edit, expectedSource) => {
        assert(isObject(edit) && validImagePath(edit.path) &&
          edit.path.startsWith(`images/${bottle.id}/`) && /\.(?:webp|png)$/.test(edit.path) &&
          edit.path !== photo.path && edit.path !== photo.cutout?.path &&
          edit.sourcePath === expectedSource, 'Ungültige Bildkorrektur', 400, "api.errors.invalidPhotoAdjustment");
        try {validatePhotoAdjustments(edit.settings);}
        catch {assert(false, 'Ungültige Bildkorrekturwerte', 400, "api.errors.invalidImageAdjustmentValues");}
        assert(!photoPaths.has(edit.path), 'Doppelte Bildkorrektur', 400, "api.errors.duplicateImageAdjustment");
        photoPaths.add(edit.path);
      };
      if (photo.adjustment !== undefined) {
        // Old v0.17.x datasets could reference either base; new edits
        // on selected cutouts are stored within cutout.adjustment.
        assert(photo.adjustment.sourcePath === photo.path ||
          photo.adjustment.sourcePath === photo.cutout?.path, 'Ungültige Bildquelle', 400, "api.errors.invalidImageSource");
        verifyAdjustment(photo.adjustment, photo.adjustment.sourcePath);
      }
      if (photo.cutout?.adjustment !== undefined)
        verifyAdjustment(photo.cutout.adjustment, photo.cutout.path);
      assert(!photoIds.has(photo.id) && !photoPaths.has(photo.path), 'Doppeltes Flaschenfoto', 400, "api.errors.duplicateBottlePhoto");
      photoIds.add(photo.id);
      photoPaths.add(photo.path);
    }
    assert(bottle.files === undefined || Array.isArray(bottle.files), 'Ungueltige Dateiliste', 400, "api.errors.invalidFileList");
    const fileIds = new Set();
    for (const file of bottle.files || []) {
      assert(isObject(file) && isString(file.id) && /^[a-f0-9-]{36}$/i.test(file.id)
        && isDocumentPath(file.path, bottle.id), 'Ungueltiger Dateianhang', 400, "api.errors.invalidFileAttachment");
      assert(isString(file.name) && file.name.length > 0 && file.name.length <= 180
        && !/[\\/\x00-\x1f\x7f]/.test(file.name), 'Ungueltiger Anhangname', 400, "api.errors.invalidAttachmentName");
      assert(Number.isSafeInteger(file.size) && file.size > 0, 'Ungueltige Anhanggroesse', 400, "api.errors.invalidAttachmentSize");
      assert(isString(file.mimeType) && file.mimeType.length < 150, 'Ungueltiger Anhangtyp', 400, "api.errors.invalidAttachmentType");
      assert(isString(file.sha256) && /^[a-f0-9]{64}$/i.test(file.sha256), 'Ungueltiger Datei-Pruefwert', 400, "api.errors.invalidFileChecksum");
      assert(isString(file.uploadedAt) && !Number.isNaN(Date.parse(file.uploadedAt)), 'Ungueltiges Upload-Datum', 400, "api.errors.invalidUploadDate");
      assert(!fileIds.has(file.id) && !documentPaths.has(file.path), 'Doppelter Dateianhang', 400, "api.errors.duplicateFileAttachment");
      fileIds.add(file.id);
      documentPaths.add(file.path);
    }
    if (bottle.inventoryNumber) {
      assert(!inventoryNumbers.has(bottle.inventoryNumber), 'Inventarnummer bereits vergeben', 409, "api.errors.inventoryNumberAlreadyAssigned");
      inventoryNumbers.add(bottle.inventoryNumber);
    }
    bottleIds.add(bottle.id);
  }
  assert(new Set(collection.reservedInventoryNumbers).size === collection.reservedInventoryNumbers.length, 'Doppelte reservierte Inventarnummern', 400, "api.errors.duplicateReservedInventoryNumbers");
  for (const n of collection.reservedInventoryNumbers) {
    assert(isString(n) && n, 'Ungültige reservierte Inventarnummer', 400, "api.errors.invalidReservedInventoryNumber");
  }
  return collection;
}
export function requireField(value, name) {
  assert(isString(value) && value.trim(), `${name} ist erforderlich`, 400, "api.errors.requiredField", {field: name});
  return value.trim();
}
