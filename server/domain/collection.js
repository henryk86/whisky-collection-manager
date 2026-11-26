/**
 * Pure collection helpers. Bottles are always nested inside their owning
 * bottling.
 */
import crypto from 'node:crypto';
/**
 * Returns a timestamp suitable for collection audit fields.
 *
 * @return {string} Current UTC instant formatted as an ISO timestamp.
 */
export const now = () => new Date().toISOString();

/**
 * Generates a UUID for a new collection record.
 * @return {string} Random UUID.
 */
export const uid = () => crypto.randomUUID();
export const WHISKY_TYPES = [
  'single_malt',
  'single_grain',
  'blended_malt',
  'blended_grain',
  'blended_scotch',
];
/**
 * Flattens the physical bottles nested under all bottlings.
 * @param {import('../../shared/types.js').Collection} db Collection with nested bottlings.
 * @return {import('../../shared/types.js').Bottle[]} Physical bottle references in collection order.
 */
export function allBottles(db) {
  return db.bottlings.flatMap(b => b.bottles || []);
}

/**
 * Retrieves bottle for collection.
 *
 * @param {*} db Db used by this operation.
 * @param {string} id Identifier used to select the relevant record.
 * @return {?Object} Computed value, or null when the input has no match.
 */
export function findBottle(db, id) {
  for (const bottling of db.bottlings) {
    const bottle = (bottling.bottles || []).find(b => b.id === id);
    if (bottle) {
      return {
        bottling, bottle,
      };
    }
  }
  return null;
}
