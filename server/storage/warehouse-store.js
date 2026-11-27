/**
 * Warehouse is a separate document. Neither reads nor writes collection.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {DATA_DIR} from './paths.js';
import {fail} from '../domain/errors.js';
import {PublishedWriteError, ensureDurableDirectory, writeDurableFile} from '../../shared/durable-files.js';
import {trackMutation} from '../domain/mutation-tracker.js';
import {FURNITURE_TYPES, SHELF_FRONTS, totalExplicitHeightCm}
  from '../../shared/warehouse-compartments.js';

export const WAREHOUSE_FILE = path.join(DATA_DIR, 'warehouse.json');
/**
 * Creates an empty warehouse independently of collection storage.
 *
 * @return {{schemaVersion: number, rooms: !Array<!Object>,
 *     assignments: !Object}} Empty warehouse data.
 */
export const emptyWarehouse = () => ({schemaVersion: 1, rooms: [], assignments: {}});

/**
 * Normalizes the valid text text for subsequent processing.
 *
 * @param {*} value Value to process.
 * @param {number=} max Maximum accepted value.
 * @return {boolean} True for nonempty trimmed text within the permitted maximum length.
 */
function validText(value, max = 100) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
}

/**
 * Derives the valid number numeric value from its input.
 *
 * @param {*} value Value to process.
 * @param {*} min Minimum accepted value.
 * @param {*} max Maximum accepted value.
 * @return {boolean} True for a finite numeric value within the inclusive bounds.
 */
function validNumber(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

/**
 * Validates warehouse rooms, furniture, shelf IDs and assignments.
 *
 * @param {!Object} data Warehouse document to validate.
 * @return {!Object} The original warehouse document on success.
 * @throws {HttpError} If the document violates warehouse constraints.
 */
export function validateWarehouse(data) {
  if (!data || data.schemaVersion !== 1 || !Array.isArray(data.rooms) || !data.assignments || typeof data.assignments !== 'object' ||
    Array.isArray(data.assignments)) {
    throw fail('Ungültige Lagerdatei', 400, "api.errors.invalidStorageFile");
  }
  const ids = new Set();
  const shelfIds = new Set();
  for (const room of data.rooms) {
    if (!validText(room.id, 120) || !validText(room.name) || !validNumber(room.width, 1, 100) ||
      !validNumber(room.height, 1, 100) ||
      !Array.isArray(room.furniture)) throw fail('Ungültiger Lagerraum', 400, "api.errors.invalidStorageRoom");
    if (ids.has(room.id)) throw fail('Doppelte Lager-ID', 400, "api.errors.duplicateStorageID"); ids.add(room.id);
    for (const furniture of room.furniture) {
      if (!validText(furniture.id, 120) || !validText(furniture.name) || !FURNITURE_TYPES.includes(furniture.type) ||
        !validNumber(furniture.x, 0, room.width) ||
        !validNumber(furniture.y, 0, room.height) ||
        !validNumber(furniture.width, 0.2, 20) ||
        !validNumber(furniture.depth, 0.2, 20) || ![0, 90, 180, 270].includes(furniture.rotation) ||
        (furniture.elevation !== undefined && !validNumber(furniture.elevation, 0, 10)) ||
        (furniture.itemHeight !== undefined && !validNumber(furniture.itemHeight, 0.1, 5)) ||
        ['leftSidePanel', 'rightSidePanel', 'backPanel'].some(key =>
          furniture[key] !== undefined && typeof furniture[key] !== 'boolean') ||
        (furniture.doorLeaves != null && ![1, 2].includes(furniture.doorLeaves)) ||
        (furniture.glassFrame != null && typeof furniture.glassFrame !== 'boolean') ||
        !Array.isArray(furniture.shelves)) throw fail('Ungültiges Lagermöbel', 400, "api.errors.invalidStorageFurniture");
      if (furniture.photos !== undefined &&
        (!Array.isArray(furniture.photos) || furniture.photos.length > 24 ||
          furniture.photos.some(photo => !photo || !validText(photo.id, 120) || !validText(photo.path, 300) ||
            !/^images\/[\w-]+\/furniture-[\w-]+\.(?:jpg|png|webp|gif)$/.test(photo.path) ||
            photo.path.split('/')[1] !== furniture.id))) throw fail('Ungültige Möbelfotos', 400, "api.errors.invalidFurniturePhotos");
      if (furniture.doorRanges !== undefined) {
        if (!Array.isArray(furniture.doorRanges) || furniture.doorRanges.length > 100) throw fail('Ungültige Türbereiche', 400, "api.errors.invalidDoorAreas");
        const covered = new Set();
        for (const range of furniture.doorRanges) {
          if (!range || !Number.isInteger(range.from) || !Number.isInteger(range.to) || range.from < 1 || range.to < range.from || range.to > furniture.shelves.length ||
            !['door', 'glass'].includes(range.front) ||
            (range.doorLeaves != null && ![1, 2].includes(range.doorLeaves)) ||
            (range.glassFrame != null && typeof range.glassFrame !== 'boolean')) throw fail('Ungültiger Türbereich', 400, "api.errors.invalidDoorArea");
          for (let i = range.from; i <= range.to; i++) {
            if (covered.has(i)) throw fail('Überlappende Türbereiche', 400, "api.errors.overlappingDoorAreas");
            covered.add(i);
          }
        }
      }
      const effectiveW = furniture.rotation % 180 === 0 ? furniture.width : furniture.depth;
      const effectiveH = furniture.rotation % 180 === 0 ? furniture.depth : furniture.width;
      if (furniture.x + effectiveW > room.width + 0.00001 || furniture.y + effectiveH > room.height + 0.00001) throw fail('Lagermöbel liegt außerhalb des Raums', 400, "api.errors.storageFurnitureLiesOutsideTheRoom");
      if (ids.has(furniture.id)) throw fail('Doppelte Lager-ID', 400, "api.errors.duplicateStorageID"); ids.add(furniture.id);
      for (const shelf of furniture.shelves) {
        if (!validText(shelf.id, 120) || !validText(shelf.name) ||
          (shelf.capacity !== null && (!Number.isInteger(shelf.capacity) || shelf.capacity < 0 || shelf.capacity > 10000)) ||
          (shelf.front !== undefined && shelf.front !== null && !SHELF_FRONTS.includes(shelf.front)) ||
          (shelf.heightCm !== undefined && shelf.heightCm !== null && !validNumber(shelf.heightCm, 5, 500)) ||
          (shelf.doorLeaves != null && ![1, 2].includes(shelf.doorLeaves)) ||
          (shelf.glassFrame != null && typeof shelf.glassFrame !== 'boolean')) throw fail('Ungültiges Lagerfach', 400, "api.errors.invalidStorageCompartment");
        if (ids.has(shelf.id)) throw fail('Doppelte Lager-ID', 400, "api.errors.duplicateStorageID"); ids.add(shelf.id);
        shelfIds.add(shelf.id);
      }
      const explicit = totalExplicitHeightCm(furniture.shelves);
      const available = (furniture.itemHeight ?? (furniture.type === 'haengeregal' ? 0.4 : 1.8)) * 100;
      const autoCount = furniture.shelves.filter(shelf => shelf.heightCm == null).length;
      if (explicit > available + 0.001 || (explicit > 0 && autoCount && available - explicit < autoCount * 5 - 0.001))
        throw fail('Die Fachhöhen passen nicht zur Möbelhöhe', 400, "api.errors.compartmentHeightsDoNotFitTheFurnitureHeight");
    }
  }
  for (const [bottleId, shelfId] of Object.entries(data.assignments)) {
    if (!validText(bottleId, 120) || !shelfIds.has(shelfId)) throw fail('Ungültige Lagerzuordnung', 400, "api.errors.invalidStorageAssignment");
  }
  return data;
}

let warehouseCache = null;
let warehouseIdentity = null;
let warehouseRevision = crypto.randomUUID();
/**
 * Produces the identity text used by the caller.
 * @return {string} Warehouse file metadata fingerprint for cache invalidation.
 */
function identity() {
  const {dev, ino, size, mtimeMs, ctimeMs} = fs.statSync(WAREHOUSE_FILE);
  return `${dev}:${ino}:${size}:${mtimeMs}:${ctimeMs}`;
}

/**
 * Invalidates cached warehouse state after a committed mutation.
 */
export function invalidateWarehouseCache() {
  warehouseCache = null;
  warehouseIdentity = null;
  warehouseRevision = crypto.randomUUID();
}

/**
 * Reloads and validates the warehouse data when its backing file identity changes.
 */
function loadWarehouse() {
  const current = identity();
  if (warehouseCache === null || warehouseIdentity !== current) {
    warehouseCache = structuredClone(validateWarehouse(JSON.parse(fs.readFileSync(WAREHOUSE_FILE, 'utf8'))));
    warehouseIdentity = current;
    warehouseRevision = crypto.randomUUID();
  }
}

/**
 * Returns the current warehouse revision for HTTP cache validation.
 *
 * @return {string} Quoted weak ETag.
 */
export function warehouseETag() {
  initWarehouse();
  loadWarehouse();
  return `W/"warehouse-${warehouseRevision}"`;
}

/**
 * Initializes warehouse storage without overwriting existing rooms.
 * Creates an empty file only when the file does not already exist.
 */
export function initWarehouse() {
  ensureDurableDirectory(DATA_DIR);
  if (!fs.existsSync(WAREHOUSE_FILE)) writeWarehouse(emptyWarehouse());
  loadWarehouse();
}

/**
 * Returns a deep copy of the current warehouse model.
 *
 * @return {!Object} Validated warehouse data, including rooms and
 * assignments.
 */
export function readWarehouse() {
  initWarehouse();
  return structuredClone(warehouseCache);
}

/**
 * Persists warehouse to its backing store.
 *
 * @param {*} data Input data to process.
 */
function writeWarehouse(data) {
  validateWarehouse(data);
  let published = false;
  try {
    writeDurableFile(WAREHOUSE_FILE, JSON.stringify(data, null, 2) + '\n');
    published = true;
    warehouseCache = structuredClone(data);
    warehouseIdentity = identity();
    warehouseRevision = crypto.randomUUID();
  } catch (error) {
    invalidateWarehouseCache();
    throw published ? new PublishedWriteError(WAREHOUSE_FILE, error) : error;
  }
}
/** @type {Promise<unknown>} */
let pending = Promise.resolve();
/**
 * Serializes warehouse updates and commits each successful mutation.
 *
 * A rejected mutation does not affect later writes or the current warehouse.
 *
 * @template T
 * @param {(warehouse: Object) => T|Promise<T>} mutator Mutates a fresh copy.
 * @return {!Promise<T>} Result after the write has committed.
 */
export function changeWarehouse(mutator) {
  const task = pending.then(async () => {
    const data = readWarehouse();
    const result = await mutator(data);
    const previous = warehouseCache;
    const beforeEtag = warehouseETag();
    writeWarehouse(data);
    trackMutation('warehouse', previous, data, beforeEtag, warehouseETag());
    return result;
  });
  pending = task.catch(() => {});
  return task;
}
