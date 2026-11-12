import { t } from '../../i18n/index.js';
/** A small self-contained, interactive OpenStreetMap raster viewer.
 * Downloads ONLY tiles in the current viewport (no prefetch/offline cache).
 * The browser honours tile.openstreetmap.org's HTTP cache and Referer policy.
 */
import { MAX_MAP_ZOOM, clusterMarkerDiameter, fitMapToSites, markerDiameter, project, tileSize, unproject, zoomAroundPoint } from '../../domain/distillery-map.js';
import { pagodaRoofIcon, closedDistilleryIcon } from '../../ui/action-icons.js';
import { clusterMapSites } from '../../domain/map-clusters.js';

const TILE_BASE = 'https://tile.openstreetmap.org';
export function createTileMap(element, sites, onSelect, selectedId = null, { showAllDistilleries = false, focusSiteIds = [] } = {}) {
    const layer = element.querySelector('.map-movable');
    const tiles = element.querySelector('.map-tiles');
    const markers = element.querySelector('.map-markers');
    const viewport = element.querySelector('.map-viewport');
    if (!layer || !tiles || !markers || !viewport) throw new Error(t("features.map.containerMissing"));
    let center, zoom, viewChanged = false, destroyed = false, pinnedId = null;
    const pointers = new Map();
    let drag = null, pinch = null, lastDrag = 0;

    function dimensions() { return { width: viewport.clientWidth, height: viewport.clientHeight }; }
    function update() {
        if (destroyed) return;
        const { width, height } = dimensions();
        if (!width || !height) return;
        const projectedCenter = project(center.lat, center.lon, zoom);
        const left = projectedCenter.x - width / 2;
        const top = projectedCenter.y - height / 2;
        const world = 2 ** zoom;
        const minX = Math.floor(left / tileSize);
        const maxX = Math.floor((left + width) / tileSize);
        const minY = Math.max(0, Math.floor(top / tileSize));
        const maxY = Math.min(world - 1, Math.floor((top + height) / tileSize));
        const fragment = document.createDocumentFragment();
        // Only actually visible tiles, not other zoom levels or a wider map.
        for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) {
            const image = document.createElement('img');
            image.src = `${TILE_BASE}/${zoom}/${((x % world) + world) % world}/${y}.png`;
            image.alt = '';
            image.draggable = false;
            image.decoding = 'async';
            image.style.left = `${Math.round(x * tileSize - left)}px`;
            image.style.top = `${Math.round(y * tileSize - top)}px`;
            image.width = tileSize; image.height = tileSize;
            fragment.append(image);
        }
        tiles.replaceChildren(fragment);
        const markerFragment = document.createDocumentFragment();
        for (const group of clusterMapSites(sites, zoom, { pinnedId })) {
            const x = group.x - left, y = group.y - top;
            if (x < -80 || x > width + 80 || y < -80 || y > height + 80) continue;
            const marker = document.createElement('button');
            marker.type = 'button';
            marker.style.left = `${x}px`;
            marker.style.top = `${y}px`;
            const selected = group.sites.some(site => site.id === selectedId);
            if (group.sites.length > 1) {
                const count = group.sites.length;
                const diameter = clusterMarkerDiameter(group.bottleCount);
                marker.className = `map-marker map-marker-cluster map-cluster-visual${selected ? ' selected' : ''}`;
                marker.style.width = `${diameter}px`;
                marker.style.height = `${diameter}px`;
                marker.textContent = String(group.bottleCount);
                marker.title = t("map.marker.clusterTitle",{bottles:group.bottleCount,distilleries:count});
                marker.setAttribute('aria-label', marker.title);
                marker.addEventListener('click', event => {
                    if (Date.now() - lastDrag < 260) { event.preventDefault(); return; }
                    event.stopPropagation();
                    if (zoom < MAX_MAP_ZOOM) {
                        center = unproject(group.x, group.y, zoom);
                        zoom = Math.min(MAX_MAP_ZOOM, zoom + 2);
                        pinnedId = null;
                        viewChanged = true;
                        update();
                    }

                });
            } else {
                const site = group.sites[0];
                const location = site.location;
                const isPagoda = showAllDistilleries && site.bottleCount === 0;
                const isClosed = site.status === 'closed';
                const diameter = isPagoda ? 35 : markerDiameter(site.bottleCount);
                marker.className = `map-marker${isPagoda ? ' map-marker-pagoda' : ' map-stock-visual'}${isClosed ? ' map-marker-closed' : ''}${selected ? ' selected' : ''}`;
                marker.style.width = `${diameter}px`;
                marker.style.height = `${diameter}px`;
                marker.title = t("map.marker.siteTitle",{name:site.name,bottlings:site.bottlingCount,bottles:site.bottleCount,status:site.status==='closed'?t('home.status.closed'):site.status==='reopened'?t('features.status.reopened'):site.status==='active'?t('map.status.active'):t('features.distilleries.unknownStatus'),approximate:location.approximate?t('features.map.approximateLocation'): ''});
                marker.setAttribute('aria-label', marker.title);
                if (isPagoda) marker.innerHTML = isClosed ? closedDistilleryIcon : pagodaRoofIcon;
                else marker.textContent = String(site.bottleCount);
                marker.addEventListener('click', event => {
                    if (Date.now() - lastDrag < 260) { event.preventDefault(); return; }
                    event.stopPropagation(); selectedId = site.id; update(); onSelect(site.id);
                });
            }
            if (group.anchorX !== undefined && group.anchorY !== undefined) {
                const anchorX = group.anchorX - left;
                const anchorY = group.anchorY - top;
                const distance = Math.hypot(x - anchorX, y - anchorY);
                const stem = document.createElement('span');
                stem.className = 'map-marker-stem';
                stem.style.left = `${anchorX}px`;
                stem.style.top = `${anchorY}px`;
                stem.style.width = `${distance}px`;
                stem.style.transform = `rotate(${Math.atan2(y - anchorY, x - anchorX)}rad)`;
                markerFragment.append(stem);
            }
            markerFragment.append(marker);
        }
        markers.replaceChildren(markerFragment);
        const info = element.querySelector('.map-zoom-level');
        if (info) info.textContent = `Zoom ${zoom}`;
    }
    function fit() {
        center = fitMapToSites(sites, dimensions().width || 680, dimensions().height || 420);
        zoom = center.zoom;
        viewChanged = false;
        pinnedId = null;
        update();
    }
    function fitSites(ids) {
        const idSet = new Set(ids);
        const matches = sites.filter(site => idSet.has(site.id) && site.location);
        if (!matches.length) return;
        const fitted = fitMapToSites(matches, dimensions().width || 680, dimensions().height || 420);
        center = { lat: fitted.lat, lon: fitted.lon };
        zoom = fitted.zoom;
        pinnedId = matches.length === 1 ? matches[0].id : null;
        viewChanged = true;
        update();
    }
    function panBy(dx, dy) {
        const point = project(center.lat, center.lon, zoom);
        center = unproject(point.x - dx, point.y - dy, zoom);
        center.lat = Math.max(-85, Math.min(85, center.lat));
        viewChanged = true;
        pinnedId = null;
        update();
    }
    function setZoom(next, anchor) {
        const { width, height } = dimensions();
        const view = zoomAroundPoint(center, zoom, next, width, height, anchor?.x, anchor?.y);
        if (view.zoom === zoom) return;
        center = { lat: view.lat, lon: view.lon };
        zoom = view.zoom;
        pinnedId = null;
        viewChanged = true;
        update();
    }
    function focus(site) {
        if (!site?.location) return;
        center = { ...site.location };
        zoom = Math.max(zoom, 10);
        viewChanged = true;
        selectedId = site.id;
        pinnedId = site.id;
        update();
    }
    const down = event => {
        if (event.target.closest('button,a')) return;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        viewport.setPointerCapture?.(event.pointerId);
        if (pointers.size === 1) drag = { x: event.clientX, y: event.clientY, moved: false };
        if (pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom };
            drag = null;
        }
    };
    const move = event => {
        if (!pointers.has(event.pointerId)) return;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size === 2 && pinch) {
            const [a, b] = [...pointers.values()];
            const ratio = Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.distance);
            const change = ratio >= 1.35 ? 1 : ratio <= .75 ? -1 : 0;
            if (change) {
                const rect = viewport.getBoundingClientRect();
                setZoom(pinch.zoom + change, {
                    x: (a.x + b.x) / 2 - rect.left,
                    y: (a.y + b.y) / 2 - rect.top,
                });
                pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom };
            }
            return;
        }
        if (drag) {
            const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
            if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
            layer.style.transform = `translate(${dx}px, ${dy}px)`;
        }
    };
    const up = event => {
        if (!pointers.has(event.pointerId)) return;
        pointers.delete(event.pointerId);
        if (drag?.moved) {
            layer.style.transform = '';
            lastDrag = Date.now();
            panBy(event.clientX - drag.x, event.clientY - drag.y);
        }
        else layer.style.transform = '';
        drag = null;
        if (pointers.size < 2) pinch = null;
    };
    const wheel = event => {
        if (!event.deltaY) return;
        const rect = viewport.getBoundingClientRect();
        const x = event.clientX - rect.left, y = event.clientY - rect.top;
        // Only zoom around the cursor when it is inside the visible map.
        if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
        event.preventDefault();
        setZoom(zoom + (event.deltaY < 0 ? 1 : -1), { x, y });
    };
    const keyboard = event => {
        if (event.target !== viewport) return;
        if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom(zoom + 1); }
        else if (event.key === '-') { event.preventDefault(); setZoom(zoom - 1); }
        else if (event.key.startsWith('Arrow')) {
            const offsets = { ArrowUp: [0, 90], ArrowDown: [0, -90], ArrowLeft: [90, 0], ArrowRight: [-90, 0] };
            event.preventDefault(); panBy(...offsets[event.key]);
        }
    };
    viewport.addEventListener('pointerdown', down);
    viewport.addEventListener('pointermove', move);
    viewport.addEventListener('pointerup', up);
    viewport.addEventListener('pointercancel', up);
    viewport.addEventListener('wheel', wheel, { passive: false });
    viewport.addEventListener('keydown', keyboard);
    const handleZoom = event => {
        const action = event.target.closest('[data-map-control]')?.dataset.mapControl;
        if (action === 'in') setZoom(zoom + 1);
        else if (action === 'out') setZoom(zoom - 1);
        else if (action === 'fit') fit();
    };
    element.addEventListener('click', handleZoom);
    const resize = new ResizeObserver(() => { if (!destroyed) viewChanged ? update() : fit(); });
    resize.observe(viewport);
    fit();
    if (focusSiteIds.length) fitSites(focusSiteIds);
    return {
        focus, fitSites,
        select(id) { selectedId = id; update(); },
        fit,
        destroy() {
            destroyed = true;
            resize.disconnect();
            viewport.removeEventListener('pointerdown', down);
            viewport.removeEventListener('pointermove', move);
            viewport.removeEventListener('pointerup', up);
            viewport.removeEventListener('pointercancel', up);
            viewport.removeEventListener('wheel', wheel);
            viewport.removeEventListener('keydown', keyboard);
            element.removeEventListener('click', handleZoom);
        },
    };
}

/** Accessible map structure and OSM attribution; all tile requests happen in
 * createTileMap while the map page is actually visible. */
export function mapCanvasHtml() {
    return `<div class="map-canvas" id="distillery-map">
      <div class="map-viewport" tabindex="0" role="application" aria-label="${t("features.map.keyboardInstructions")}">
        <div class="map-movable"><div class="map-tiles" aria-hidden="true"></div><div class="map-markers"></div></div>
      </div>
      <div class="map-controls" aria-label="${t("features.map.controls")}">
        <button type="button" data-map-control="in" aria-label="${t("features.map.zoomIn")}" title="${t("features.map.zoomInAction")}">+</button>
        <button type="button" data-map-control="out" aria-label="${t("features.map.zoomOut")}" title="${t("features.map.zoomOutAction")}">−</button>
        <button type="button" data-map-control="fit" aria-label="${t("features.map.showAllLocations")}" title="${t("features.map.showAllLocations")}">⊡</button>
      </div>
      <div class="map-zoom-level" aria-hidden="true"></div>
      <div class="map-attribution">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">${t("features.map.openStreetMapCredits")}</a></div>
    </div>`;
}
