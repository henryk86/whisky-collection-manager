/** The map associates one bottling with every constituent distillery, never a midpoint. */
export function bottlingDistilleryIds(bottling) {
    if (!bottling) return [];
    const ids = Array.isArray(bottling.distilleryIds) ? bottling.distilleryIds : (bottling.distilleryId ? [bottling.distilleryId] : []);
    return [...new Set(ids.filter(id => typeof id === 'string' && id.length > 0))];
}

export function matchingBottlingSites(bottling, located, missing = []) {
    const ids = new Set(bottlingDistilleryIds(bottling));
    return [...located, ...missing].filter(site => ids.has(site.id));
}
