import fs from 'node:fs';
/**
 * Legacy migrations are isolated from normal CRUD. Each step is safe to run
 * again.
 */
import {assert} from '../domain/errors.js';
import {allBottles, now, uid} from '../domain/collection.js';
import {validate} from '../domain/validation.js';
const internationalSeed = JSON.parse(fs.readFileSync(new URL('../../seed/distillery.json', import.meta.url), 'utf8'));

// Convert legacy top-level bottles into the owning bottling before validation.
/**
 * Moves legacy physical bottles into their parent bottlings.
 *
 * @param {*} db Legacy collection modified in place to nest physical bottles under their bottlings.
 * @return {boolean} True if any legacy bottle nesting or redundant ownership fields changed.
 */
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
      assert(owner, 'Verwaiste Flasche kann nicht migriert werden', 400, "api.errors.orphanedBottleCannotBeMigrated");
      if (owner.bottles.some(b => b.id === bottle.id)) {
        throw new Error('Doppelte Flaschen-ID bei Migration');
      }
      const {bottlingId, ...nested} = bottle;
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
// From v0.5.9 onward the printed/scanned inventory number is the only
// identifier.
// Conflicting legacy fields are logged in an external migration report, never
// silently used as an additional identification field.

/**
 * Normalizes inventory numbering from earlier collection schemas.
 *
 * @param {*} db Legacy collection whose inventory numbers and old label codes are reconciled in place.
 * @return {!Object} Whether inventory numbering changed, together with detected conflicts.
 */
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
            inventoryNumber: previous, previousLabelCode: label,
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
      // Previously a label-only code wasn't necessarily reserved as an
      // inventory number.
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
    changed, conflicts,
  };
}

/**
 * Upgrades legacy bottle-category labels to current values.
 *
 * @param {*} db Collection whose physical bottles may still contain the obsolete labelType field.
 * @return {boolean} True if obsolete bottle label-type fields were removed.
 */
export function migrateLabelTypes(db) {
  let changed = false;
  for (const bottle of allBottles(db)) {
    if (Object.hasOwn(bottle, 'labelType')) {
      delete /** @type {import('../../shared/types.js').Bottle & {labelType?: string}} */ (bottle).labelType;
      changed = true;
    }
  }
  return changed;
}

/**
 * Updates legacy distillery references to the current record structure.
 *
 * @param {*} db Collection whose bottlings may still refer to a single legacy distilleryId.
 * @return {boolean} True if any distillery references were migrated.
 */
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

/**
 * Normalizes stored photo metadata when upgrading older collections.
 *
 * @param {*} db Collection whose image metadata must be moved to physical bottle photo lists.
 * @return {boolean} True if any legacy photo metadata was migrated.
 */
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
          id: uid(), path: file, createdAt: now(), legacyType: kind,
        });
      }
    }
    delete bottling.images;
    changed = true;
  }
  return changed;
}

/**
 * Move the former bottling-wide sample type to individual physical bottles.
 * Keep bottling.volumeMl as the nominal size published by the producer; each
 * bottle additionally receives its own actual size when known.
 *
 * @param {*} db Collection whose legacy bottling-level bottle type is propagated to physical bottles.
 * @return {boolean} True if bottle volume fields or the associated schema version changed.
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

/**
 * Existing collections can gain the optional document list without data loss.
 *
 * @param {*} db Collection whose physical bottle records may lack a files array.
 * @return {boolean} True if missing bottle document lists were added.
 */
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

/**
 * Add newly published international sites without overwriting user changes.
 *
 * @param {*} db Collection whose distillery catalog is augmented from the international seed.
 * @return {boolean} True if any new international distilleries were added.
 */
export function migrateInternationalDistilleries(db) {
  if (!Array.isArray(db.distilleries)) return false;
  const currentNames = new Set(db.distilleries.map(d => d.name.trim().toLocaleLowerCase('en')));
  const currentIds = new Set(db.distilleries.map(d => d.id));
  let changed = false;
  for (const entry of internationalSeed.filter(d => d.country)) {
    if (currentNames.has(entry.name.trim().toLocaleLowerCase('en')) || currentIds.has(entry.id)) continue;
    db.distilleries.push({...entry});
    currentNames.add(entry.name.trim().toLocaleLowerCase('en'));
    currentIds.add(entry.id);
    changed = true;
  }
  return changed;
}

/**
 * Fill missing origin metadata from the published distillery catalogue. Never
 * change user-set status, coordinates or explicit geographic fields.
 * Country/region belong to distilleries, not to individual bottlings.
 *
 * @param {*} db Collection whose existing distilleries are matched against known origin metadata.
 * @return {boolean} True if any missing or legacy origin metadata was updated.
 */
export function migrateDistilleryOrigins(db) {
  if (!Array.isArray(db.distilleries)) return false;
  const catalog = new Map(internationalSeed.map(d => [d.name.trim().toLocaleLowerCase('en'), d]));
  let changed = false;
  for (const site of db.distilleries) {
    const known = catalog.get(site.name.trim().toLocaleLowerCase('en'));
    if (!known) continue;
    // Historic generic UK codes conceal the Scottish origin of a known site.
    // Do not reinterpret UK for unknown sites, Wales, England or Northern
    // Ireland.
    if (known.country === 'Schottland' &&
      /^(?:UK|GB|United Kingdom|Vereinigtes Königreich)$/i.test(site.country?.trim() || '')) {
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

/**
 * Mutates a parsed document only. The caller backs up and commits it after
 * validation.
 *
 * @param {!Object} collection Collection data being processed.
 * @return {!Object} Migration change flag and inventory-number conflicts.
 */
export function migrateCollection(collection) {
  assert(
    collection && typeof collection === 'object' && !Array.isArray(collection),
    'Ungültige Sammlungsstruktur',
    400,
    "api.errors.invalidCollectionStructure"
  );
  assert(
    Array.isArray(collection.bottlings) && Array.isArray(collection.reservedInventoryNumbers),
    'Ungültige Sammlungsstruktur',
    400,
    "api.errors.invalidCollectionStructure"
  );
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
    changed: changes.some(Boolean) || inventory.changed,
    conflicts: inventory.conflicts,
  };
}

/**
 * Upgrade historical collections without discarding inventory, distilleries,
 * physical bottles, media references, settings or any warehouse data. Only
 * pre-schema-5 sensory data is intentionally not carried forward. Schemas 5 through 7
 * are upgraded losslessly to schema 8. The input is never changed; validation runs
 * before any file is replaced.
 *
 * @param {*} source Untrusted collection document, validated for a supported schema before migration.
 * @return {!Object} Independent upgraded collection, change flag and detected inventory conflicts.
 */
export function migrateCollectionToCurrent(source) {
  assert(
    source && typeof source === 'object' && !Array.isArray(source) && Number.isSafeInteger(source.schemaVersion) && source.schemaVersion >= 1 && source.schemaVersion <= 8,
    'Unbekannte oder neuere Sammlungsversion: vorhandene Daten bleiben unverändert',
    400,
    "api.errors.unsupportedCollectionVersion"
  );
  const collection = structuredClone(source);
  if (collection.schemaVersion === 8) {
    validate(collection);
    return {collection, changed: false, conflicts: []};
  }
  if (collection.schemaVersion >= 5) {
    // v5 -> v6 adds optional ratingComment; v6 -> v7 adds optional
    // purchaseEvidence; v7 -> v8 separates the physical storage files. Preserve metadata, including explicit flags
    // from transitional installations. Unclassified attachments stay unclassified.
    collection.schemaVersion = 8;
    validate(collection);
    return {collection, changed: true, conflicts: []};
  }
  const previous = migrateCollection(collection);
  for (const bottling of collection.bottlings) {
    // v4 tastings, legacy bottle scores and cached sensory summaries
    // are the ONLY intentionally discarded content during this upgrade.
    bottling.tastings = [];
    for (const name of [
      'rating',
      'tastingNotes',
      'flavorProfile',
      'whiskyColor',
      'legacyTastings',
    ]) {
      delete bottling[name];
    }
    for (const bottle of bottling.bottles) {
      delete bottle.rating;
      delete bottle.tastingNotes;
    }
  }
  collection.externalTastings = [];
  collection.tastingFlights = [];
  collection.schemaVersion = 8;
  validate(collection);
  return {collection, changed: true, conflicts: previous.conflicts};
}
