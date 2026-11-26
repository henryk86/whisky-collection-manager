/** Shared warehouse shelf layout contract (metres in 3D, centimetres in
 * JSON/UI).
 * Older warehouses omit `front` and `heightCm`; those fields are optional.
 * The stored `shelves` array is ordered from BOTTOM to TOP.
 */
export const FURNITURE_TYPES = Object.freeze([
  'regal',
  'vitrine',
  'schrank',
  'kommode',
  'kiste',
  'haengeregal',
  'sonstiges',
]);
export const SHELF_FRONTS = Object.freeze(['open', 'door', 'glass', 'drawer']);

/** @typedef {'open'|'door'|'glass'|'drawer'} ShelfFront */
/** @typedef {'regal'|'vitrine'|'schrank'|'kommode'|'kiste'|'haengeregal'|'sonstiges'} FurnitureType */
/**
 * Stored shelf, ordered bottom-to-top within its furniture item.
 * @typedef {Object} WarehouseShelf
 * @property {string} id Shelf identifier.
 * @property {string} name Display name.
 * @property {number} capacity Maximum number of physical bottles; zero disables storage.
 * @property {?number} [heightCm] Explicit compartment height in centimetres; null or absent means automatic.
 * @property {?ShelfFront} [front] Explicit front or inherited furniture default.
 * @property {?number} [doorLeaves] One or two leaves; null means default.
 * @property {?boolean} [glassFrame] Explicit framed-glass preference.
 */
/**
 * A single door covering consecutive shelf numbers.
 * @typedef {Object} DoorRange
 * @property {number} from First shelf, numbered from 1 at the bottom.
 * @property {number} to Last shelf, inclusive.
 * @property {'door'|'glass'} front Opaque or transparent door.
 * @property {?number} [doorLeaves] Explicit leaf count.
 * @property {?boolean} [glassFrame] Explicit frame configuration.
 */
/**
 * Fields consumed by the shared vertical geometry helpers. Horizontal layout
 * fields are independent of the shelf allocation algorithm.
 * @typedef {Object} ShelfLayout
 * @property {FurnitureType|string} type Furniture category.
 * @property {WarehouseShelf[]} shelves Compartments in bottom-to-top order.
 * @property {number} [itemHeight] Furniture height in metres.
 * @property {number} [elevation] Height of the base above the floor in metres.
 * @property {DoorRange[]} [doorRanges] Shared door spans.
 */
/**
 * Derived compartment geometry in absolute room coordinates.
 * @typedef {Object} ShelfLevel
 * @property {WarehouseShelf} shelf Original shelf record (not copied).
 * @property {number} index Zero-based index, from the bottom.
 * @property {number} bottom Lower edge in metres above the room floor.
 * @property {number} top Upper edge in metres above the room floor.
 * @property {number} height Compartment height in metres.
 * @property {number} heightCm Compartment height in centimetres.
 * @property {ShelfFront} front Shelf-level front, independent of shared doors.
 */
/**
 * Selects the default front-edge arrangement of a shelf.
 *
 * @param {FurnitureType|string} type Furniture category; unknown categories use an open shelf.
 * @return {ShelfFront} Default opaque, glazed, drawer or open front.
 */
export function defaultShelfFront(type) {
  return {schrank: 'door', vitrine: 'glass', kommode: 'drawer', kiste: 'door'}[type] ?? 'open';
}

/**
 * Resolves the shelf front in light of inherited furniture settings.
 *
 * @param {WarehouseShelf|null|undefined} shelf Shelf whose optional override is read.
 * @param {FurnitureType|string} furnitureType Category used for the fallback.
 * @return {ShelfFront} Explicit front or the category default.
 */
export function effectiveShelfFront(shelf, furnitureType) {
  return shelf?.front == null ? defaultShelfFront(furnitureType) : shelf.front;
}

/**
 * Door ranges cover consecutive shelves, numbered from bottom (1) to top.
 *
 * @param {ShelfLayout} item Furniture containing shared doors.
 * @param {number} index Zero-based shelf index.
 * @return {?DoorRange} First encompassing door span, or null.
 */
export function doorRangeForIndex(item, index) {
  return (item.doorRanges || []).find(range => index + 1 >= range.from && index + 1 <= range.to) || null;
}

/**
 * Determines the shelf-front shape displayed by the UI.
 *
 * @param {ShelfLayout} item Furniture containing shelves and optional shared doors.
 * @param {number} index Zero-based shelf index.
 * @return {ShelfFront} Shared door front if covered; otherwise the effective shelf front.
 */
export function visibleShelfFront(item, index) {
  return doorRangeForIndex(item, index)?.front ?? effectiveShelfFront(item.shelves[index], item.type);
}

/**
 * Computes the visible height of furniture and its shelves.
 *
 * @param {ShelfLayout} item Furniture, possibly without an explicit height.
 * @return {number} Height in metres; defaults to 0.4 for wall shelves and 1.8 otherwise.
 */
export function furnitureHeight(item) {
  return Number(item.itemHeight ?? (item.type === 'haengeregal' ? 0.4 : 1.8));
}

/**
 * Totals explicitly configured shelf heights in centimetres.
 *
 * @param {WarehouseShelf[]} shelves Compartments, including automatic-height shelves.
 * @return {number} Sum of explicitly assigned centimetres.
 */
export function totalExplicitHeightCm(shelves) {
  return shelves.reduce((sum, shelf) => sum + (shelf.heightCm == null ? 0 : Number(shelf.heightCm)), 0);
}

/**
 * No mutation. Returns visible bays from bottom to top, preserving real
 * heights. If all bays have a fixed height below the furniture height, the
 * remainder is deliberately left as clearance at the top, not added to a fixed
 * bay.
 *
 * @param {ShelfLayout} item Furniture geometry and bottom-to-top compartments.
 * @return {ShelfLevel[]} Absolute levels; unspecified heights share remaining space equally.
 */
export function shelfLevels(item) {
  const shelves = item.shelves || [];
  const height = furnitureHeight(item);
  const base = Number(item.elevation ?? 0);
  if (!shelves.length) return [];
  const remaining = Math.max(0, height * 100 - totalExplicitHeightCm(shelves));
  const autoCount = shelves.filter(s => s.heightCm == null).length;
  let bottom = base;
  return shelves.map((shelf, index) => {
    const cm = shelf.heightCm == null ? remaining / Math.max(1, autoCount) : Number(shelf.heightCm);
    const top = bottom + cm / 100;
    const entry = {
      shelf,
      index,
      bottom,
      top,
      height: cm / 100,
      heightCm: cm,
      front: effectiveShelfFront(shelf, item.type),
    };
    bottom = top;
    return entry;
  });
}
