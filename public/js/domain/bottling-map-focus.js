/**
 * The map associates one bottling with every constituent distillery, never a
 * midpoint.
 *
 * @param {!Object} bottling Bottling record being processed.
 * @return {!Array<*>} Distinct constituent distillery identifiers.
 */
export function bottlingDistilleryIds(bottling) {
  if (!bottling) return [];
  const ids = Array.isArray(bottling.distilleryIds) ?
    bottling.distilleryIds : (bottling.distilleryId ? [bottling.distilleryId] : []);
  return [...new Set(ids.filter(id => typeof id === 'string' && id.length > 0))];
}

/**
 * Finds known distillery locations associated with a bottling.
 *
 * @param {!Object} bottling Bottling record being processed.
 * @param {*} located Known geographic sites available for selection.
 * @param {!Array<*>=} missing Referenced distilleries without coordinates, included alongside located sites.
 * @return {!Array<*>} Located or unresolved sites associated with the bottling's distilleries.
 */
export function matchingBottlingSites(bottling, located, missing = []) {
  const ids = new Set(bottlingDistilleryIds(bottling));
  return [...located, ...missing].filter(site => ids.has(site.id));
}
