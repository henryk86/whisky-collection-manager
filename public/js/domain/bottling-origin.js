/** Show distilleries first; otherwise show just the bottler's name, without a prefix. */
export function bottlingOriginLabel(bottling, distilleryNames) {
    const ids = Array.isArray(bottling.distilleryIds)
        ? bottling.distilleryIds : (bottling.distilleryId ? [bottling.distilleryId] : []);
    const distilleries = ids.length ? String(distilleryNames(bottling) || '').trim() : '';
    if (distilleries) return distilleries;
    return typeof bottling.bottler === 'string' ? bottling.bottler.trim() : '';
}
