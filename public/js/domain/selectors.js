import {displayPhotoPath} from '../../../shared/photo-images.js';

/** @typedef {import('../../../shared/types.js').Bottling} Bottling */
/** @typedef {import('../../../shared/types.js').Bottle} Bottle */
/** @typedef {{bottle: Bottle, bottling: Bottling}} BottleOwner */
/**
 * Live selectors. Returned records are references to the current collection,
 * not independent copies; callers must not mutate them as part of rendering.
 * @typedef {Object} CollectionSelectors
 * @property {function(string): string} distilleryName Name for an ID, with unknown fallback.
 * @property {function(Bottling): string[]} distilleryIds Contributor IDs.
 * @property {function(Bottling): string} distilleryNames Joined contributor labels.
 * @property {function(string): Bottle[]} bottles Physical bottles for a bottling.
 * @property {function(): Bottle[]} allBottles Flattened physical inventory.
 * @property {function(string): ?BottleOwner} findBottle Owner and bottle lookup.
 * @property {function(string): string} coverPhoto Effective photo path or empty text.
 */
/**
 * Read-only selectors; always read the latest collection after a refresh.
 *
 * @param {{collection: import('../../../shared/types.js').Collection}} state Mutable application state; selectors read the current collection each time.
 * @return {!CollectionSelectors} Read-only collection lookup functions.
 */
export function createSelectors(state) {
  /**
   * Looks up a contributor name in the current collection.
   *
   * @param {string} id Distillery identifier.
   * @return {string} Name or the unknown-distillery fallback.
   */
  const distilleryName = id => state.collection.distilleries.find(d => d.id === id)?.name || 'Unbekannte Destillerie';

  /**
   * Reads contributor IDs, including the old single-ID representation.
   *
   * @param {Bottling & {distilleryId?: string}} b Bottling with current or legacy contributor metadata.
   * @return {!Array<string>} Contributor IDs in their stored order.
   */
  const distilleryIds = b => Array.isArray(b.distilleryIds) ? b.distilleryIds : (b.distilleryId ? [b.distilleryId] : []);

  /**
   * Resolves and joins a bottling's contributor names.
   *
   * @param {Bottling} b Bottling whose contributors are displayed.
   * @return {string} Comma-separated names or the missing-distillery label.
   */
  const distilleryNames = b => distilleryIds(b).map(distilleryName).join(', ') || 'Keine Destillerie angegeben';

  /**
   * Looks up physical inventory belonging to a bottling.
   *
   * @param {string} id Bottling identifier.
   * @return {!Array<Bottle>} Physical bottles or an empty list if the bottling is missing.
   */
  const bottles = id => state.collection.bottlings.find(b => b.id === id)?.bottles || [];

  /**
   * Flattens all owned bottlings into the physical inventory.
   * @return {!Array<Bottle>} Physical bottles in collection order.
   */
  const allBottles = () => state.collection.bottlings.flatMap(b => b.bottles || []);

  /**
   * Finds a physical bottle together with its owning bottling.
   *
   * @param {string} id Physical bottle identifier.
   * @return {?BottleOwner} Matched record pair, or null if absent.
   */
  const findBottle = id => {
    for (const bottling of state.collection.bottlings) {
      const bottle = (bottling.bottles || []).find(b => b.id === id);
      if (bottle) {
        return {
          bottle, bottling,
        };
      }
    }
    return null;
  };

  /**
   * Resolves the effective image of the first photo across a bottling's physical inventory.
   *
   * @param {string} id Bottling identifier.
   * @return {string} Effective photo path or empty text.
   */
  const coverPhoto = id => displayPhotoPath(bottles(id).flatMap(b => b.photos || [])[0]);
  return {
    distilleryName,
    distilleryIds,
    distilleryNames,
    bottles,
    allBottles,
    findBottle,
    coverPhoto,
  };
}

/**
 * Exact string matching is intentional: 000123 is not the same as 123.
 *
 * @param {import('../../../shared/types.js').Collection} collection Owned inventory.
 * @param {*} value Input inventory number, converted to trimmed text.
 * @return {?BottleOwner} Exact physical-bottle match and its owner, or null.
 */
export function lookupInventoryNumber(collection, value) {
  const number = String(value ?? '').trim();
  if (!number) {
    return null;
  }
  for (const bottling of collection.bottlings) {
    const bottle = (bottling.bottles || []).find(entry => entry.inventoryNumber === number);
    if (bottle) {
      return {
        bottling, bottle,
      };
    }
  }
  return null;
}
