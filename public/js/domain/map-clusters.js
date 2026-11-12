import { MAX_MAP_ZOOM, markerDiameter, project } from './distillery-map.js';

// Cluster geographic locations in *world* pixels. Unlike a viewport grid, this
// keeps groups stable when the map is dragged or resized at the same zoom level.
// No data is aggregated or modified in the collection itself.
export const CLUSTER_DISTANCE_PX = 58;

export function clusterMapSites(sites, zoom, { pinnedId = null } = {}) {
    const groups = [];
    // The last zoom level is a detail view: never aggregate distinct sites.
    const radiusSquared = zoom >= MAX_MAP_ZOOM ? 0 : CLUSTER_DISTANCE_PX ** 2;
    for (const site of sites) {
        if (!site.location) continue;
        const point = project(site.location.lat, site.location.lon, zoom);
        let closest = null;
        let nearestSquared = radiusSquared;
        if (site.id !== pinnedId) {
            for (const group of groups) {
                if (group.pinned) continue;
                const distanceSquared = (group.x - point.x) ** 2 + (group.y - point.y) ** 2;
                if (distanceSquared < nearestSquared) {
                    nearestSquared = distanceSquared;
                    closest = group;
                }
            }
        }
        if (!closest) {
            groups.push({ x: point.x, y: point.y, sites: [site], bottleCount: site.bottleCount,
                bottlingCount: site.bottlingCount, pinned: site.id === pinnedId });
        } else {
            const length = closest.sites.length;
            closest.x = (closest.x * length + point.x) / (length + 1);
            closest.y = (closest.y * length + point.y) / (length + 1);
            closest.sites.push(site);
            closest.bottleCount += site.bottleCount;
            closest.bottlingCount += site.bottlingCount;
        }
    }
    if (zoom >= MAX_MAP_ZOOM) spreadOverlappingSites(groups);
    return groups;
}

// At maximum zoom, nearby sites (including identical catalog coordinates)
// must remain independently selectable. Arrange only truly overlapping
// markers around their projected locations and preserve the real anchor for
// a small visual connector. This changes neither coordinates nor bottle data.
function spreadOverlappingSites(groups) {
    const visited = new Set();
    const ordered = [...groups].sort((a, b) => String(a.sites[0].id).localeCompare(String(b.sites[0].id)));
    const diameter = group => Math.max(35, markerDiameter(group.bottleCount));
    for (const start of ordered) {
        if (visited.has(start)) continue;
        const component = [];
        const pending = [start];
        visited.add(start);
        while (pending.length) {
            const current = pending.pop();
            component.push(current);
            for (const other of ordered) {
                if (visited.has(other)) continue;
                const minDistance = (diameter(current) + diameter(other)) / 2 + 8;
                if (Math.hypot(current.x - other.x, current.y - other.y) >= minDistance) continue;
                visited.add(other);
                pending.push(other);
            }
        }
        if (component.length < 2) continue;
        component.sort((a, b) => String(a.sites[0].id).localeCompare(String(b.sites[0].id)));
        const anchorX = component.reduce((total, group) => total + group.x, 0) / component.length;
        const anchorY = component.reduce((total, group) => total + group.y, 0) / component.length;
        const maxDiameter = Math.max(...component.map(diameter));
        // Distribute markers on a circle with enough separation for touch.
        const radius = Math.max(38, (maxDiameter + 10) / (2 * Math.sin(Math.PI / component.length)));
        component.forEach((group, index) => {
            group.anchorX = group.x;
            group.anchorY = group.y;
            const angle = -Math.PI / 2 + 2 * Math.PI * index / component.length;
            group.x = anchorX + radius * Math.cos(angle);
            group.y = anchorY + radius * Math.sin(angle);
        });
    }
}
