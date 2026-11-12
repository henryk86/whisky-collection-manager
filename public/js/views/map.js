import { t } from '../i18n/index.js';
import { buildDistilleryMap, markerDiameter } from '../domain/distillery-map.js';
import { mapBottlingFacts } from '../domain/map-bottling-meta.js';
import { escapeHtml } from '../ui/dom.js';
import { editIcon, pagodaRoofIcon, closedDistilleryIcon } from '../ui/action-icons.js';
import { backToCollectionButton } from '../ui/navigation-controls.js';
import { createTileMap, mapCanvasHtml } from '../features/map/tile-map.js';
import { matchingBottlingSites } from '../domain/bottling-map-focus.js';

const PAGE_LIMIT = 12;
const ALL_SITES_PREF = 'wcm-map-all-distilleries';
const readAllSitesPreference = () => {
    try { return localStorage.getItem(ALL_SITES_PREF) === '1'; }
    catch { return false; }
};
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

/** A compact legend explains the marker styles without duplicating the map's
 * interactive marker dimensions. Relative stock sizes stay distinguishable. */
export const legendMarkerDiameter = count => Math.max(21, Math.round(markerDiameter(count) * 0.62));
const LEGEND_CLUSTER_DIAMETER = 27;
export function mapLegendHtml(showAllDistilleries = false) {
    const stockExample = (count, extraClass = '') => `<span class="map-stock-visual map-legend-marker ${extraClass}" style="--legend-diameter:${legendMarkerDiameter(count)}px" aria-hidden="true">${count}</span>`;
    const samples = [1, 10, 100].map(count => `<span class="map-legend-item" aria-label="${plural(count, t("forms.bottle.title"), t("forms.bottle.plural"))}">
      ${stockExample(count, 'map-legend-stock-icon')}</span>`).join('');
    const emptySites = showAllDistilleries ? `<div class="map-legend-section map-legend-empty" role="group" aria-label="${t("map.legend.distilleriesWithoutBottles")}">
        <span class="map-legend-heading">${t("map.filters.withoutBottles")}</span>
        <span class="map-legend-item map-pagoda-legend">${pagodaRoofIcon}${t("map.status.active")}</span>
        <span class="map-legend-item map-pagoda-legend map-closed-legend">${closedDistilleryIcon}${t("home.status.closed")}</span>
      </div>` : '';
    return `<div class="map-legend" role="group" aria-label="${t("map.legend.title")}">
      <div class="map-legend-section map-legend-status" role="group" aria-label="${t("map.legend.distilleriesWithBottles")}">
        <span class="map-legend-heading">${t("map.filters.withBottles")}</span>
        <span class="map-legend-item">${stockExample(1, 'map-legend-status-icon')}${t("map.status.active")}</span>
        <span class="map-legend-item">${stockExample(1, 'map-marker-closed map-legend-status-icon')}${t("home.status.closed")}</span>
      </div>${emptySites}
      <div class="map-legend-section map-legend-stock" role="group" aria-label="${t("map.statistics.bottlesPerDistillery")}">
        <span class="map-legend-heading">${t("map.statistics.bottleCount")}</span>${samples}
      </div>
      <div class="map-legend-section map-legend-clusters" role="group" aria-label="${t("map.statistics.groupedDistilleries")}">
        <span class="map-legend-item"><span class="map-cluster-visual map-legend-marker map-cluster-legend-icon" style="--legend-diameter:${LEGEND_CLUSTER_DIAMETER}px" aria-hidden="true">6</span>${t("map.filters.grouped")}</span>
      </div>
    </div>`;
}

/** One logical site per distillery; nearby map markers cluster at small zoom levels. */
export function createMapView({ state, shell, navigate, settings }) {
    let tileMap = null;
    let selectedId = null;
    let search = '';
    let page = 1;
    let missingFilter = '';
    let sites = [];
    let missing = [];
    let showAllDistilleries = readAllSitesPreference();
    let relatedBottling = null;
    let relatedSites = [];
    let priorFocusId = null;

    function relatedSitesHtml() {
        if (!relatedBottling) return '';
        const entries = relatedSites.map(site => site.location
            ? `<button type="button" class="map-related-site" data-map-focus="${escapeHtml(site.id)}">${escapeHtml(site.name)}</button>`
            : `<span class="map-related-missing">${escapeHtml(site.name)} · ${t("map.filters.withoutLocation")} <button type="button" class="map-related-set-location" data-map-edit="${escapeHtml(site.id)}">${t("map.actions.setLocation")}</button></span>`).join('');
        return `<div class="map-related-bottling" aria-label="${t("map.bottling.locations")}">
          <strong>${t("map.bottling.locationsFor", {name:escapeHtml(relatedBottling.name)})}</strong>
          ${entries ? `<div class="map-related-sites">${entries}</div>` : `<p class="hint">${t("map.empty.noCatalogMatches")}</p>`}
        </div>`;
    }

    function sidebarHtml() {
        const selected = sites.find(site => site.id === selectedId) || null;
        const filtered = selected ? selected.bottlings.filter(entry => entry.name.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de'))) : [];
        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_LIMIT));
        page = Math.max(1, Math.min(page, totalPages));
        const subset = filtered.slice((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT);
        return `${relatedSitesHtml()}<div class="map-site-panel">
        <label class="form-field map-site-chooser" for="map-site-select">${t("map.actions.showDistillery")}
        <select id="map-site-select" ${sites.length ? '' : 'disabled'}>
          ${sites.length && !selectedId ? `<option value="" selected>${t("map.filters.selectLocation")}</option>` : ''}
          ${sites.length ? sites.map(site => `<option value="${escapeHtml(site.id)}" ${site.id === selectedId ? 'selected' : ''}>${escapeHtml(site.name)} · ${site.bottleCount ? plural(site.bottleCount, t("forms.bottle.title"), t("forms.bottle.plural")) : t("map.filters.withoutBottlesLowercase")}</option>`).join('') : `<option>${t("map.empty.noGeolocatedDistillery")}</option>`}
        </select></label>
        ${selected ? `<div class="map-site-heading"><div class="map-site-title"><strong>${escapeHtml(selected.name)}</strong>
          <button class="btn small map-position-edit" type="button" data-map-edit="${escapeHtml(selected.id)}" aria-label="${t("map.actions.correctLocationFor",{name:escapeHtml(selected.name)})}" title="${t("map.actions.correctLocation")}">${editIcon}</button></div>
          <span>${plural(selected.bottlingCount, t("forms.bottling.title"), t("analytics.inventory.bottlings"))} · ${plural(selected.bottleCount, t("forms.bottle.title"), t("forms.bottle.plural"))} · ${selected.status === 'closed' ? t("home.status.closed") : selected.status === 'reopened' ? t("map.status.reopened") : selected.status === 'active' ? t("map.status.active") : t("features.distilleries.unknownStatus")}${selected.location?.approximate ? t("features.map.approximateLocation") : ''}</span></div>
          ${selected.bottlingCount ? `<label class="form-field map-bottling-search">${t("map.actions.searchBottlingsAtLocation")}
            <input id="map-bottling-search" type="search" placeholder="${t("map.filters.searchNamePlaceholder")}" value="${escapeHtml(search)}" autocomplete="off"></label>
          <div class="map-bottling-list" aria-label="${t("map.bottling.bottlingsAtSite",{name:escapeHtml(selected.name)})}">
            ${subset.length ? subset.map(entry => `<button type="button" class="map-bottling-link" data-map-bottling="${escapeHtml(entry.id)}">
              <span>${escapeHtml(entry.name)}</span>${mapBottlingFacts(entry) ? `<small class="map-bottling-facts">${escapeHtml(mapBottlingFacts(entry))}</small>` : ''}<small>${plural(entry.bottleCount, t("forms.bottle.title"), t("forms.bottle.plural"))}</small></button>`).join('') : `<p class="hint">${t("map.empty.noMatchingBottlings")}</p>`}
          </div>
          ${totalPages > 1 ? `<div class="map-list-pager"><button type="button" data-map-page="prev" ${page === 1 ? 'disabled' : ''} aria-label="${t("map.pagination.previousBottlings")}">‹</button><span>${t("map.pagination.pageOf", {page,total:totalPages})}</span><button type="button" data-map-page="next" ${page === totalPages ? 'disabled' : ''} aria-label="${t("map.pagination.moreBottlings")}">›</button></div>` : ''}` : `<p class="hint map-empty-site">${t("map.empty.noCollectionBottlings")}</p>`}` : `<p class="hint">${t("map.empty.chooseDistillery")}</p>`}
        </div>`;
    }
    function missingHtml() {
        const filtered = missing.filter(site => site.name.toLocaleLowerCase('de').includes(missingFilter.toLocaleLowerCase('de')));
        return `<details class="map-missing" ${!sites.length ? 'open' : ''}>
          <summary>${t("map.statistics.unmappedCount", {count:missing.length})}</summary>
          ${missing.length > 6 ? `<label class="form-field">${t("map.filters.searchDistillery")}<input id="map-missing-search" type="search" placeholder="${t("map.filters.namePlaceholder")}" value="${escapeHtml(missingFilter)}"></label>` : ''}
          <div id="map-missing-list">${missingRows(filtered)}</div>
        </details>`;
    }
    function missingRows(items) {
        return items.length ? items.slice(0, 18).map(site => `<div class="map-missing-row"><span>${escapeHtml(site.name)}</span><button type="button" class="btn small" data-map-edit="${escapeHtml(site.id)}">${t("map.actions.setLocation")}</button></div>`).join('') + (items.length > 18 ? `<p class="hint">${t("map.search.moreResults", {count:items.length-18})}</p>` : '') : `<p class="hint">${t("map.empty.noMatchingDistilleries")}</p>`;
    }
    function renderSidebar({ focusSearch = false } = {}) {
        const sidebar = document.getElementById('map-sidebar');
        if (!sidebar) return;
        sidebar.innerHTML = sidebarHtml() + (missing.length > 0 ? missingHtml() : '');
        if (focusSearch) {
            const field = document.getElementById('map-bottling-search');
            field?.focus();
            field?.setSelectionRange(field.value.length, field.value.length);
        }
        const selectedInput = sidebar.querySelector('#map-site-select');
        selectedInput?.addEventListener('change', () => select(selectedInput.value, true));
        sidebar.querySelector('#map-bottling-search')?.addEventListener('input', event => {
            search = event.target.value;
            page = 1;
            renderSidebar({ focusSearch: true });
        });
        sidebar.querySelector('#map-missing-search')?.addEventListener('input', event => {
            missingFilter = event.target.value;
            const panel = sidebar.querySelector('#map-missing-list');
            if (panel) panel.innerHTML = missingRows(missing.filter(site => site.name.toLocaleLowerCase('de').includes(missingFilter.toLocaleLowerCase('de'))));
        });
        sidebar.querySelectorAll('[data-map-focus]').forEach(button => button.addEventListener('click', () => select(button.dataset.mapFocus, true)));
        sidebar.querySelectorAll('[data-map-page]').forEach(button => button.addEventListener('click', () => {
            page += button.dataset.mapPage === 'next' ? 1 : -1;
            renderSidebar();
        }));
        sidebar.querySelectorAll('[data-map-bottling]').forEach(button => button.addEventListener('click', () => {
            navigate('detail', button.dataset.mapBottling);
        }));
        sidebar.querySelectorAll('[data-map-edit]').forEach(button => button.addEventListener('click', () => {
            settings.promptDistillery(button.dataset.mapEdit);
        }));
    }
    function select(id, focusMap = false) {
        if (!sites.some(site => site.id === id)) return;
        selectedId = id;
        search = '';
        page = 1;
        renderSidebar();
        if (focusMap) tileMap?.focus(sites.find(site => site.id === id));
        else tileMap?.select(id);
    }
    function render() {
        tileMap?.destroy(); tileMap = null;
        const mapData = buildDistilleryMap(state.collection, { includeAllDistilleries: showAllDistilleries });
        sites = mapData.located;
        missing = mapData.missing;
        relatedBottling = state.selected ? state.collection.bottlings.find(entry => entry.id === state.selected) || null : null;
        relatedSites = relatedBottling ? matchingBottlingSites(relatedBottling, sites, missing) : [];
        if (priorFocusId !== relatedBottling?.id) {
            selectedId = relatedSites.find(site => site.location)?.id || null;
            priorFocusId = relatedBottling?.id || null;
        }
        if (!sites.some(site => site.id === selectedId)) {
            selectedId = relatedBottling ? (relatedSites.find(site => site.location)?.id || null)
                : (sites.find(site => site.bottleCount > 0)?.id || sites[0]?.id || null);
        }
        const bottleTotal = sites.reduce((sum, site) => sum + site.bottleCount, 0);
        shell(`<section class="section-head map-heading"><div>
          <span class="eyebrow dark">${t("map.page.eyebrow")}</span>
          <h2>${t("navigation.map")}<span class="heading-period">.</span></h2>
          <p class="intro">${t("map.page.description")}</p></div>
          ${backToCollectionButton}</section>
          <div class="map-summary"><span><strong>${sites.length}</strong> ${t("map.statistics.mappedDistilleries")}</span>
          <span><strong>${bottleTotal}</strong> ${t("map.statistics.assignedBottles")}</span>
          ${missing.length > 0 ? `<span><strong>${missing.length}</strong> ${t("map.filters.withoutLocation")}</span>` : ''}
          <label class="map-all-toggle" for="map-all-distilleries"><span>${t("map.actions.showAllDistilleries")}</span>
          <input id="map-all-distilleries" type="checkbox" role="switch" ${showAllDistilleries ? 'checked' : ''}></label></div>
          <div class="map-layout">
            <div class="map-stage">${mapCanvasHtml()}
            ${mapLegendHtml(showAllDistilleries)}
            ${!sites.length ? `<div class="map-no-sites">${t("map.empty.noMappedDistilleries")}</div>` : ''}
            </div>
            <aside id="map-sidebar" class="map-sidebar" aria-label="${t("map.page.title")}"></aside>
          </div>
          `);
        renderSidebar();
        document.getElementById('map-all-distilleries')?.addEventListener('change', event => {
            showAllDistilleries = event.target.checked;
            try { localStorage.setItem(ALL_SITES_PREF, showAllDistilleries ? '1' : '0'); }
            catch { /* Browsers without storage can still switch modes. */ }
            render();
        });
        tileMap = createTileMap(document.getElementById('distillery-map'), sites, id => select(id), selectedId, {
            showAllDistilleries,
            focusSiteIds: relatedSites.filter(site => site.location).map(site => site.id),
        });
    }
    function destroy() { tileMap?.destroy(); tileMap = null; }
    return { render, destroy };
}
