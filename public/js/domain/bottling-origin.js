/**
 * Prefers the names of known distilleries, otherwise displays the bottler without a prefix.
 *
 * @param {!Object} bottling Bottling with contributor IDs and optional bottler.
 * @param {*} distilleryNames Callback returning the display names of the bottling's distilleries.
 * @return {*} Trimmed origin label, or empty text when unknown.
 */
export function bottlingOriginLabel(bottling, distilleryNames) {
  const ids = Array.isArray(bottling.distilleryIds)
    ? bottling.distilleryIds : (bottling.distilleryId ? [bottling.distilleryId] : []);
  const distilleries = ids.length ? String(distilleryNames(bottling) || '').trim() : '';
  if (distilleries) return distilleries;
  return typeof bottling.bottler === 'string' ? bottling.bottler.trim() : '';
}
