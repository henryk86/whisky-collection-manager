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
/**
 * Selects the default front-edge arrangement of a shelf.
 *
 * @param {*} type Type used by this operation.
 * @return {*} Structured result assembled from the input data.
 */
export function defaultShelfFront(type) {
  return {schrank: 'door', vitrine: 'glass', kommode: 'drawer', kiste: 'door'}[type] ?? 'open';
}

/**
 * Resolves the shelf front in light of inherited furniture settings.
 *
 * @param {*} shelf Shelf used by this operation.
 * @param {*} furnitureType Furniture type used by this operation.
 * @return {*} Result computed from the supplied inputs.
 */
export function effectiveShelfFront(shelf, furnitureType) {
  return shelf?.front == null ? defaultShelfFront(furnitureType) : shelf.front;
}

/**
 * Door ranges cover consecutive shelves, numbered from bottom (1) to top.
 *
 * @param {*} item Warehouse item or record being evaluated.
 * @param {number} index Zero-based index of the item.
 * @return {*} Result computed from the supplied inputs.
 */
export function doorRangeForIndex(item, index) {
  return (item.doorRanges || []).find(range => index + 1 >= range.from && index + 1 <= range.to) || null;
}

/**
 * Determines the shelf-front shape displayed by the UI.
 *
 * @param {*} item Warehouse item or record being evaluated.
 * @param {number} index Zero-based index of the item.
 * @return {*} Value returned by the delegated operation.
 */
export function visibleShelfFront(item, index) {
  return doorRangeForIndex(item, index)?.front ?? effectiveShelfFront(item.shelves[index], item.type);
}

/**
 * Computes the visible height of furniture and its shelves.
 *
 * @param {*} item Warehouse item or record being evaluated.
 * @return {number} Calculated numeric result.
 */
export function furnitureHeight(item) {
  return Number(item.itemHeight ?? (item.type === 'haengeregal' ? 0.4 : 1.8));
}

/**
 * Totals explicitly configured shelf heights in centimetres.
 *
 * @param {*} shelves Shelves used by this operation.
 * @return {*} Combined value obtained from the entries.
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
 * @param {*} item Warehouse item or record being evaluated.
 * @return {*} Array of values selected for the caller.
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
