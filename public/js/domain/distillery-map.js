import { APPROXIMATE_LOCATIONS, normalizeDistilleryName } from './distillery-locations.js';
/** Explicitly stored coordinates take priority over the built-in directory. */
export const ISLAY_LOCATIONS = Object.freeze({
    'ardbeg': [55.6406, -6.1086],
    'lagavulin': [55.6360, -6.1270],
    'laphroaig': [55.6300, -6.1522],
    'port ellen': [55.6250, -6.1750],
    'bowmore': [55.7571, -6.2898],
    'bruichladdich': [55.7664, -6.3625],
    'kilchoman': [55.7869, -6.4308],
    'ardnahoe': [55.8690, -6.1175],
    'bunnahabhain': [55.8832, -6.1263],
    'caol ila': [55.8545, -6.1093],
    'laggan bay': [55.6825, -6.2564],
});

export function locationFor(distillery) {
    if (Number.isFinite(distillery.latitude) && Number.isFinite(distillery.longitude)) {
        return { lat: distillery.latitude, lon: distillery.longitude, source: 'saved' };
    }
    const key = normalizeDistilleryName(distillery.name);
    const exact = ISLAY_LOCATIONS[key];
    if (exact) return { lat: exact[0], lon: exact[1], source: 'catalog' };
    const approximate = APPROXIMATE_LOCATIONS.get(key);
    return approximate ? { lat: approximate[0], lon: approximate[1], source: 'catalog', approximate: true } : null;
}

/** Count the actual physical bottles, not the number of bottling records.
 * For multi-distillery blends, a bottling and its bottles are associated with
 * each named contributor, never with a guessed midpoint.
 */
export function buildDistilleryMap(collection, { includeAllDistilleries = false } = {}) {
    const byId = new Map((collection.distilleries || []).map(distillery => [distillery.id, distillery]));
    const groups = new Map();
    // The optional second layer includes distilleries without any bottling.
    if (includeAllDistilleries) {
        for (const distillery of byId.values()) {
            groups.set(distillery.id, {
                id: distillery.id, name: distillery.name, status: distillery.status || 'unknown', location: locationFor(distillery),
                bottlings: [], bottlingCount: 0, bottleCount: 0,
            });
        }
    }
    for (const bottling of collection.bottlings || []) {
        const ids = Array.isArray(bottling.distilleryIds) ? bottling.distilleryIds : (bottling.distilleryId ? [bottling.distilleryId] : []);
        for (const id of new Set(ids)) {
            const distillery = byId.get(id);
            if (!distillery) continue;
            let site = groups.get(id);
            if (!site) {
                site = { id, name: distillery.name, status: distillery.status || 'unknown', location: locationFor(distillery), bottlings: [], bottlingCount: 0, bottleCount: 0 };
                groups.set(id, site);
            }
            const physicalBottles = Array.isArray(bottling.bottles) ? bottling.bottles : [];
            site.bottlings.push({
                id: bottling.id, name: bottling.name, bottleCount: physicalBottles.length,
                ageYears: bottling.ageYears, abv: bottling.abv,
                distillationYear: bottling.distillationYear,
                bottlingYear: bottling.bottlingYear, releaseYear: bottling.releaseYear,
            });
            site.bottlingCount++;
            site.bottleCount += physicalBottles.length;
        }
    }
    const sorted = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
    return { located: sorted.filter(site => site.location), missing: sorted.filter(site => !site.location) };
}

/** Logarithmic visual scale, capped so a 100+ bottle site stays tappable without
 * covering half an island. 1 -> 31px, 10 -> 43px, 100 -> 59px. */
export function markerDiameter(bottleCount) {
    return Math.round(Math.min(62, 26 + 5 * Math.log2(1 + Math.max(0, bottleCount))));
}

/** Cluster size uses the same bottle scale plus a distinguishable outer ring.
 * Shared by the interactive map and its exact-size legend examples. */
export function clusterMarkerDiameter(bottleCount) {
    return Math.max(38, Math.min(66, markerDiameter(bottleCount) + 7));
}

// Web Mercator projection for interactive OSM tiles and fit-to-bounds.
export const tileSize = 256;
const maxLat = 85.05112878;
export const MAX_MAP_ZOOM = 16;
export const clampZoom = z => Math.max(2, Math.min(MAX_MAP_ZOOM, Math.round(z)));
export function project(lat, lon, zoom) {
    const scale = tileSize * 2 ** zoom;
    const latitude = Math.max(-maxLat, Math.min(maxLat, lat)) * Math.PI / 180;
    return { x: (lon + 180) / 360 * scale, y: (1 - Math.log(Math.tan(latitude) + 1 / Math.cos(latitude)) / Math.PI) / 2 * scale };
}
export function unproject(x, y, zoom) {
    const scale = tileSize * 2 ** zoom;
    return { lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * y / scale))) * 180 / Math.PI, lon: x / scale * 360 - 180 };
}
/** Zooms around a pixel inside the map viewport, keeping the geographic
 * position beneath that pixel stationary. With no pointer, use the centre.
 * All coordinates are relative to the viewport, not to the event target.
 */
export function zoomAroundPoint(center, currentZoom, requestedZoom, width, height, x = width / 2, y = height / 2) {
    const nextZoom = clampZoom(requestedZoom);
    if (nextZoom === currentZoom) return { ...center, zoom: currentZoom };
    const offsetX = x - width / 2, offsetY = y - height / 2;
    const before = project(center.lat, center.lon, currentZoom);
    const anchor = unproject(before.x + offsetX, before.y + offsetY, currentZoom);
    const after = project(anchor.lat, anchor.lon, nextZoom);
    const nextCenter = unproject(after.x - offsetX, after.y - offsetY, nextZoom);
    return { ...nextCenter, zoom: nextZoom };
}

export function fitMapToSites(sites, width, height) {
    const points = sites.filter(site => site.location).map(site => site.location);
    if (!points.length) return { lat: 55.78, lon: -6.27, zoom: 6 };
    if (points.length === 1) return { lat: points[0].lat, lon: points[0].lon, zoom: 11 };
    const pad = Math.max(28, Math.min(75, Math.min(width, height) * .12));
    for (let zoom = 12; zoom >= 2; zoom--) {
        const projected = points.map(point => project(point.lat, point.lon, zoom));
        const xs = projected.map(point => point.x), ys = projected.map(point => point.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
        if ((maxX - minX <= Math.max(1, width - 2 * pad) && maxY - minY <= Math.max(1, height - 2 * pad)) || zoom === 2) {
            const center = unproject((maxX + minX) / 2, (maxY + minY) / 2, zoom);
            return { ...center, zoom };
        }
    }
    return { lat: 55.78, lon: -6.27, zoom: 6 };
}
