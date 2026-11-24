/**
 * Show distilleries first; otherwise show just the bottler's name, without a
 * prefix.
 *
 * @param {!Object} bottling Bottling record being processed.
 * @param {*} distilleryNames Distillery names used by this operation.
 * @return {*} Result computed from the supplied inputs.
 */
export function bottlingOriginLabel(bottling, distilleryNames) {
  const ids = Array.isArray(bottling.distilleryIds)
    ? bottling.distilleryIds : (bottling.distilleryId ?
      [bottling.distilleryId] : []);
  const distilleries = ids.length ? String(distilleryNames(bottling) || '')
    .trim() : '';
  if (distilleries) return distilleries;
  return typeof bottling.bottler === 'string' ? bottling.bottler.trim() : '';
}
