import {displayPhotoPath} from '../../../shared/photo-images.js';
/**
 * Read-only selectors; always read the latest collection after a refresh.
 *
 * @param {!Object} state Current application state.
 * @return {!Object} Structured result for the caller.
 */
export function createSelectors(state) {
  /**
   * Derives the distillery name result from the supplied values.
   *
   * @param {*} id Identifier of the affected record.
   * @return {*} Result computed from the supplied inputs.
   */
  const distilleryName = id => state.collection.distilleries.find(d => d.id === id)?.name || 'Unbekannte Destillerie';

  /**
   * Derives the distillery ids result from the supplied values.
   *
   * @param {*} b Second entry or operand in the calculation.
   * @return {*} Result computed from the supplied inputs.
   */
  const distilleryIds = b => Array.isArray(b.distilleryIds) ? b.distilleryIds : (b.distilleryId ? [b.distilleryId] : []);

  /**
   * Transforms the entries used by distillery names.
   *
   * @param {*} b Second entry or operand in the calculation.
   * @return {*} Entries transformed for the consuming code.
   */
  const distilleryNames = b => distilleryIds(b).map(distilleryName).join(', ') || 'Keine Destillerie angegeben';

  /**
   * Derives the bottles result from the supplied values.
   *
   * @param {*} id Identifier of the affected record.
   * @return {*} Result computed from the supplied inputs.
   */
  const bottles = id => state.collection.bottlings.find(b => b.id === id)?.bottles || [];

  /**
   * Derives the all bottles result from the supplied values.
   * @return {*} Result computed from the supplied inputs.
   */
  const allBottles = () => state.collection.bottlings.flatMap(b => b.bottles || []);

  /**
   * Selects bottle matching the input.
   *
   * @param {*} id Identifier of the affected record.
   * @return {!Object} Computed value, or null when the input has no match.
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
   * Derives the cover photo result from the supplied values.
   *
   * @param {*} id Identifier of the affected record.
   * @return {*} Result computed from the supplied inputs.
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
 * @param {!Object} collection Collection data being processed.
 * @param {*} value Input value to process.
 * @return {?Object} Computed value, or null when the input has no match.
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
