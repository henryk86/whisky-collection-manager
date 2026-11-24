/**
 * Pure collection helpers. Bottles are always nested inside their owning
 * bottling.
 */
import crypto from 'node:crypto';
/**
 * Returns a timestamp suitable for collection audit fields.
 *
 * @return {string} Resulting text.
 */
export const now = () => new Date().toISOString();

/**
 * Creates a unique identifier for a new collection entity.
 *
 * @return {*} Result computed from the supplied inputs.
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
 * Enumerates physical bottle entries nested within bottlings.
 *
 * @param {*} db Db used by this operation.
 * @return {*} Result computed from the supplied inputs.
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
