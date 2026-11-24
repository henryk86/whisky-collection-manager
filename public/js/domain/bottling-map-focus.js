/**
 * The map associates one bottling with every constituent distillery, never a
 * midpoint.
 *
 * @param {!Object} bottling Bottling record being processed.
 * @return {!Array<*>} Resulting list of values.
 */
export function bottlingDistilleryIds(bottling) {
  if (!bottling) return [];
  const ids = Array.isArray(bottling.distilleryIds) ?
    bottling.distilleryIds : (bottling.distilleryId ?
      [bottling.distilleryId] : []);
  return [...new Set(ids.filter(id => typeof id === 'string' &&
    id.length > 0))];
}

/**
 * Finds known distillery locations associated with a bottling.
 *
 * @param {!Object} bottling Bottling record being processed.
 * @param {*} located Known geographic sites available for selection.
 * @param {!Array<*>=} missing Missing used by this operation.
 * @return {!Array<*>} Resulting list of values.
 */
export function matchingBottlingSites(bottling, located, missing = []) {
  const ids = new Set(bottlingDistilleryIds(bottling));
  return [...located, ...missing].filter(site => ids.has(site.id));
}
