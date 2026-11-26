import {createMapSidebarViewModel, createMapMissingModel, createMapDataModel} from './models/map.js';
import {composeMarkup} from '../ui/render-plan.js';
import {replaceContent, replaceElement} from '../ui/dom-renderer.js';
import {pageHeader} from '../ui/headers.js';
import {t} from '../i18n/index.js';
import {markerDiameter} from '../domain/distillery-map.js';
import {
  editIcon, pagodaRoofIcon, closedDistilleryIcon, chevronLeftIcon,
  chevronRightIcon
} from '../ui/action-icons.js';
import {backToCollectionButton} from '../ui/navigation-controls.js';
import {createTileMap, mapCanvasHtml} from '../features/map/tile-map.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates('map/map.html');


const PAGE_LIMIT = 12;
const ALL_SITES_PREF = 'wcm-map-all-distilleries';
/**
 * Retrieves all sites preference from the available state.
 * @return {boolean} Whether the operation matched or succeeded.
 */
const readAllSitesPreference = () => {
  try {return localStorage.getItem(ALL_SITES_PREF) === '1';}
  catch {return false;}
};

/**
 * Produces the plural text used by the caller.
 *
 * @param {*} count Number of requested or available entries.
 * @param {*} one Localized singular noun used when the count is one.
 * @param {*} many Localized plural noun used for all other counts.
 * @return {string} Number followed by the singular label for one, otherwise the plural label.
 */
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

/**
 * A compact legend explains the marker styles without duplicating the map's
 * interactive marker dimensions. Relative stock sizes stay distinguishable.
 *
 * @param {number} count Number of items to process.
 * @return {number} Calculated numeric result.
 */
export const legendMarkerDiameter = count => Math.max(21, Math.round(markerDiameter(count) * 0.62));
const LEGEND_CLUSTER_DIAMETER = 27;
/**
 * Prepares map marker and stock-count legend.
 *
 * @param {boolean=} showAllDistilleries Show all distilleries used by this
 * operation.
 * @return {!import('../ui/render-plan.js').RenderPlan} Map marker and stock-count legend.
 */
export function mapLegendHtml(showAllDistilleries = false) {
  /**
   * Prepares legend marker demonstrating the size for a bottle count.
   *
   * @param {*} count Number of requested or available entries.
   * @param {string=} extraClass Optional CSS class for the map stock-legend example.
   * @return {!import('../ui/render-plan.js').RenderPlan} Legend marker demonstrating the size for a bottle count.
   */
  const stockExample = (count, extraClass = '') =>
    renderTemplate('mapStockVisual', {
      extraClass: extraClass,
      legendMarkerDiameter: legendMarkerDiameter(count),
      count: count,
    });
  const samples = composeMarkup([1, 10, 100].map(count =>
    renderTemplate('mapLegendItem', {
      plural: plural(count, t("forms.bottle.title"), t("forms.bottle.plural")),
      stockExample: stockExample(count, 'map-legend-stock-icon'),
    })));
  const emptySites = showAllDistilleries ?
    renderTemplate('mapLegendSection', {
      pagodaRoofIcon: pagodaRoofIcon,
      closedDistilleryIcon: closedDistilleryIcon,
    }) : '';
  return renderTemplate('mapLegend', {
    stockExample: stockExample(1, 'map-legend-status-icon'),
    closedStockExample: stockExample(1, 'map-marker-closed map-legend-status-icon'),
    emptySites: emptySites,
    samples: samples,
    clusterDiameter: LEGEND_CLUSTER_DIAMETER,
  });
}

/**
 * One logical site per distillery; nearby map markers cluster at small zoom
 * levels.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {!Object} Structured result for the caller.
 */
export function createMapView({state, shell, navigate, settings}) {
  let tileMap = null;
  let selectedId = null;
  let search = '';
  let page = 1;
  let missingFilter = '';
  let sites = [];
  let missing = [];
  let bottleTotal = 0;
  let showAllDistilleries = readAllSitesPreference();
  let relatedBottling = null;
  let relatedSites = [];
  let priorFocusId = null;

  /**
   * Prepares locations associated with the focused bottling.
   * @return {import('../ui/render-plan.js').RenderPlan|string} Locations associated with the focused bottling (or scalar/empty text when no plan is needed).
   */
  function relatedSitesHtml() {
    if (!relatedBottling) return '';
    const entries = composeMarkup(relatedSites.map(site => site.location
      ? renderTemplate('mapRelatedSite', {
        id: site.id,
        name: site.name,
      })
      : renderTemplate('mapRelatedMissing', {
        name: site.name,
        id: site.id,
      })));
    return renderTemplate('mapRelatedBottling', {
      locationsFor: t("map.bottling.locationsFor", {name: String(relatedBottling.name ?? '')}),
      mapRelatedSites: entries ? renderTemplate('mapRelatedSites', {entries: entries, }) : renderTemplate('hint'),
    });
  }

  /**
   * Prepares selected distillery details with filtered and paginated bottlings.
   * @return {!import('../ui/render-plan.js').RenderPlan} Selected distillery details with filtered and paginated bottlings.
   */
  function sidebarHtml() {
    const {selected, totalPages, currentPage, entries} =
      createMapSidebarViewModel(sites, selectedId, search, page, PAGE_LIMIT);
    page = currentPage;
    return renderTemplate('sidebarHtml', {
      relatedSitesHtml: relatedSitesHtml(),
      disabledAttributes: sites.length ? {} : {"disabled": true},
      option: sites.length && !selectedId ? renderTemplate('sidebarHtmlOption') : '',
      siteOptions: sites.length ? composeMarkup(sites.map(site =>
        renderTemplate('sidebarHtmlOption2', {
          id: site.id,
          selectedAttributes: site.id === selectedId ? {"selected": true} : {},
          name: site.name,
          bottleCount: site.bottleCount ? plural(site.bottleCount, t("forms.bottle.title"), t("forms.bottle.plural")) : t("map.filters.withoutBottlesLowercase"),
        }))) : renderTemplate('sidebarHtmlOption3'),
      mapSiteHeading: selected ?
        renderTemplate('mapSiteHeading', {
          name: selected.name,
          id: selected.id,
          correctLocationFor: t("map.actions.correctLocationFor", {name: String(selected.name ?? '')}),
          editIcon: editIcon,
          plural: plural(selected.bottlingCount, t("forms.bottling.title"), t("analytics.inventory.bottlings")),
          bottleCountLabel: plural(selected.bottleCount, t("forms.bottle.title"), t("forms.bottle.plural")),
          status: selected.status === 'closed' ? t("home.status.closed") :
            selected.status === 'reopened' ? t("map.status.reopened") :
              selected.status === 'active' ? t("map.status.active") : t("features.distilleries.unknownStatus"),
          approximate: selected.location?.approximate ? t("features.map.approximateLocation") : '',
          formField: selected.bottlingCount ?
            renderTemplate('formField', {
              search: search,
              bottlingsAtSite: t("map.bottling.bottlingsAtSite", {name: String(selected.name ?? '')}),
              length: entries.length ? composeMarkup(entries.map(({entry, facts}) =>
                renderTemplate('mapBottlingLink', {
                  id: entry.id,
                  name: entry.name,
                  mapBottlingFacts: facts ? renderTemplate('mapBottlingFacts', {mapBottlingFacts: facts, }) : '',
                  plural: plural(entry.bottleCount, t("forms.bottle.title"), t("forms.bottle.plural")),
                }))) :
                renderTemplate('hint2'),
              mapListPager: totalPages > 1 ?
                renderTemplate('mapListPager', {
                  disabledAttributes: page === 1 ? {"disabled": true} : {},
                  chevronLeftIcon: chevronLeftIcon,
                  pageOf: t("map.pagination.pageOf", {page, total: totalPages}),
                  nextDisabled: page === totalPages ? {"disabled": true} : {},
                  chevronRightIcon: chevronRightIcon,
                }) : '',
            }) : renderTemplate('hint3'),
        }) : renderTemplate('hint4'),
    });
  }

  /**
   * Prepares missing-location panel with search and result controls.
   * @return {!import('../ui/render-plan.js').RenderPlan} Missing-location panel with search and result controls.
   */
  function missingHtml() {
    const model = createMapMissingModel(missing, missingFilter);
    return renderTemplate('mapMissing', {
      openAttributes: !sites.length ? {"open": true} : {},
      unmappedCount: t("map.statistics.unmappedCount", {count: missing.length}),
      formField: missing.length > 6 ? renderTemplate('formField2', {missingFilter: missingFilter, }) : '',
      missingRows: missingRows(model),
    });
  }

  /**
   * Prepares rows of distilleries without coordinates, or a no-results message.
   *
   * @param {*} items Entries to process.
   * @return {import('../ui/render-plan.js').RenderPlan|string} Rows of distilleries without coordinates, or a no-results message (or scalar/empty text when no plan is needed).
   */
  function missingRows({items, more}) {
    return items.length ? composeMarkup(
      composeMarkup(items.map(site =>
        renderTemplate('mapMissingRow', {
          name: site.name,
          id: site.id,
        }))),
      (more > 0 ? renderTemplate('hint5', {moreResults: t("map.search.moreResults", {count: more}), }) : '')
    ) : renderTemplate('hint6');
  }

  /**
   * Renders sidebar in the current view.
   *
   * @param {!Object=} options Options controlling the operation.
   */
  function renderSidebar({focusSearch = false} = {}) {
    const sidebar = document.getElementById('map-sidebar');
    if (!sidebar) return;
    replaceContent(sidebar, composeMarkup(sidebarHtml(), (missing.length > 0 ? missingHtml() : '')));
    if (focusSearch) {
      const field = document.getElementById('map-bottling-search');
      field?.focus();
      field?.setSelectionRange(field.value.length, field.value.length);
    }

  }

  /**
   * Selects a distillery and refreshes the map detail and selection indicators.
   *
   * @param {*} id Identifier of the affected record.
   * @param {boolean=} focusMap Whether to center the live map on the selected distillery.
   */
  function select(id, focusMap = false) {
    if (!sites.some(site => site.id === id)) return;
    selectedId = id;
    search = '';
    page = 1;
    renderSidebar();
    if (focusMap) tileMap?.focus(sites.find(site => site.id === id));
    else tileMap?.select(id);
  }

  /**
   * Updates the sync sites state for its caller.
   */
  function syncSites() {
    ({sites, missing, relatedBottling, relatedSites, selectedId, priorFocusId, bottleTotal} = createMapDataModel(state, showAllDistilleries, selectedId, priorFocusId));
  }

  /**
   * Performs the refresh data lifecycle action.
   */
  function refreshData() {
    // A saved distillery edit must not tear down the interactive map:
    // keeping the existing viewer preserves its exact camera, drag state,
    // selected marker and zoom, even when marker metadata changes.
    if (!tileMap || !document.getElementById('distillery-map')) {
      render();
      return;
    }
    syncSites();
    renderSidebar();
    tileMap.updateSites(sites, selectedId, showAllDistilleries);
    // Changing which distilleries are displayed must not refit the camera.
    const legend = document.querySelector('.map-legend');
    if (legend) replaceElement(legend, mapLegendHtml(showAllDistilleries));
    const emptyNotice = document.querySelector('.map-no-sites');
    if (sites.length) emptyNotice?.remove();
    else if (!emptyNotice) {
      const notice = document.createElement('div');
      notice.className = 'map-no-sites';
      notice.textContent = t('map.empty.noMappedDistilleries');
      document.querySelector('.map-stage')?.append(notice);
    }
    const summary = document.querySelector('.map-summary');
    const locatedCount = summary?.querySelector('[data-map-stat="located"] strong');
    const bottleCount = summary?.querySelector('[data-map-stat="bottles"] strong');
    if (locatedCount) locatedCount.textContent = String(sites.length);
    if (bottleCount) bottleCount.textContent = String(bottleTotal);
    let missingCount = summary?.querySelector('[data-map-stat="missing"]');
    if (!missing.length) missingCount?.remove();
    else {
      if (!missingCount) {
        missingCount = document.createElement('span');
        missingCount.dataset.mapStat = 'missing';
        const total = document.createElement('strong');
        missingCount.append(total, document.createTextNode(` ${t("map.filters.withoutLocation")}`));
        summary.insertBefore(missingCount, summary.querySelector('.map-all-toggle'));
      }
      missingCount.querySelector('strong').textContent = String(missing.length);
    }
  }

  /**
   * Renders the map state.
   *
   * @param {!Object=} options Optional configuration for the operation.
   */
  function render({preserveView = true} = {}) {
    const initialView = preserveView ? tileMap?.getView() : null;
    tileMap?.destroy(); tileMap = null;
    syncSites();
    shell(renderTemplate('render', {
      pageHeader: pageHeader({
        title: t('navigation.map'),
        eyebrow: t('map.page.eyebrow'),
        intro: t('map.page.description'),
        className: 'map-heading',
        copyClass: '',
        actions: backToCollectionButton(),
      }),
      length: sites.length,
      bottleTotal: bottleTotal,
      span: missing.length > 0 ? renderTemplate('renderSpan', {length: missing.length, }) : '',
      checkedAttributes: showAllDistilleries ? {"checked": true} : {},
      mapCanvasHtml: mapCanvasHtml(),
      mapLegendHtml: mapLegendHtml(showAllDistilleries),
      mapNoSites: !sites.length ? renderTemplate('mapNoSites') : '',
    }));
    renderSidebar();
    tileMap = createTileMap(
      document.getElementById('distillery-map'),
      sites,
      id => select(id),
      selectedId,
      {
        showAllDistilleries,
        focusSiteIds: relatedSites.filter(site => site.location).map(site => site.id),
        initialView,
      }
    );
  }

  /**
   * Handles the click interaction.
   *
   * @param {*} target Target of the operation.
   */
  function handleClick(target) {
    if (target.dataset.mapFocus) select(target.dataset.mapFocus, true);
    else if (target.dataset.mapPage) {
      page += target.dataset.mapPage === 'next' ? 1 : -1;
      renderSidebar();
    } else if (target.dataset.mapBottling) navigate('detail', target.dataset.mapBottling);
    else if (target.dataset.mapEdit) settings.promptDistillery(target.dataset.mapEdit);
  }

  /**
   * Handles the change interaction.
   *
   * @param {*} target Target of the operation.
   */
  function handleChange(target) {
    if (target.id === 'map-site-select') select(target.value, true);
    else if (target.id === 'map-all-distilleries') {
      showAllDistilleries = target.checked;
      try {
        localStorage.setItem(ALL_SITES_PREF, showAllDistilleries ? '1' : '0');
      }
      catch { /* No persistent browser storage. */}
      refreshData();
    }
  }

  /**
   * Handles the input interaction.
   *
   * @param {*} target Target of the operation.
   */
  function handleInput(target) {
    if (target.id === 'map-bottling-search') {
      search = target.value;
      page = 1;
      renderSidebar({focusSearch: true});
    } else if (target.id === 'map-missing-search') {
      missingFilter = target.value;
      const panel = document.getElementById('map-missing-list');
      if (panel) replaceContent(panel, missingRows(createMapMissingModel(missing, missingFilter)));
    }
  }

  /**
   * Recenters the live map after a selected distillery's coordinates are updated.
   *
   * @param {*} id Identifier of the affected record.
   */
  function centerOnUpdatedLocation(id) {
    const site = sites.find(entry => entry.id === id && entry.location);
    if (!site || !tileMap) return;
    selectedId = id;
    search = '';
    page = 1;
    renderSidebar();
    // A saved location may be far away: pan to it, but do not change zoom.
    tileMap.centerOn(site);
  }

  /**
   * Performs the destroy lifecycle action.
   */
  function destroy() {tileMap?.destroy(); tileMap = null;}
  return {
    render,
    refreshData,
    destroy,
    centerOnUpdatedLocation,
    handleClick,
    handleChange,
    handleInput,
  };
}
