import {buildDistilleryMap} from '../../domain/distillery-map.js';
import {matchingBottlingSites} from '../../domain/bottling-map-focus.js';
import {mapBottlingFacts} from '../../domain/map-bottling-meta.js';

/**
 * Prepares the selected map site and its paginated bottlings.
 * @param {!Array<!Object>} sites Available distillery sites.
 * @param {string} selectedId Selected site identifier.
 * @param {string} search Bottling search text.
 * @param {number} page Requested page.
 * @param {number} pageLimit Maximum visible entries.
 * @return {!Object} Selected site and filtered entries.
 */
export function createMapSidebarViewModel(sites, selectedId, search, page,
  pageLimit) {
  const selected = sites.find(site => site.id === selectedId) || null;
  const filtered = selected ? selected.bottlings.filter(entry => entry.name.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de'))) : [];
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageLimit));
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const subset = filtered.slice((currentPage - 1) * pageLimit, currentPage * pageLimit);
  return {selected, filtered, totalPages, currentPage, subset, entries: subset.map(entry => ({entry, facts: mapBottlingFacts(entry)}))};
}

/**
 * Prepares missing-location results without modifying or reordering the input.
 * @param {!Array<!Object>} missing Sites without coordinates.
 * @param {string} search Current filter.
 * @return {!Object} Limited result rows and remaining count.
 */
export function createMapMissingModel(missing, search) {
  const matches = missing.filter(site => site.name.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de')));
  return {items: matches.slice(0, 18), more: Math.max(0, matches.length - 18)};
}

/**
 * Resolves current map sites and the selected site after collection updates.
 * @param {!Object} state Collection and current navigation route.
 * @param {boolean} showAllDistilleries Whether sites without stock are included.
 * @param {?string} selectedId Current selected site.
 * @param {?string} priorFocusId Previously focused bottling.
 * @return {!Object} Updated map dataset, selection and focus.
 */
export function createMapDataModel(state, showAllDistilleries, selectedId, priorFocusId) {
  const {located: sites, missing} = buildDistilleryMap(state.collection, {includeAllDistilleries: showAllDistilleries});
  const relatedBottling = state.selected ? state.collection.bottlings.find(entry => entry.id === state.selected) || null : null;
  const relatedSites = relatedBottling ? matchingBottlingSites(relatedBottling, sites, missing) : [];
  const firstRelated = relatedSites.find(site => site.location)?.id || null;
  if (priorFocusId !== relatedBottling?.id) selectedId = firstRelated;
  if (!sites.some(site => site.id === selectedId)) selectedId = relatedBottling ? firstRelated : (sites.find(site => site.bottleCount > 0)?.id || sites[0]?.id || null);
  return {sites, missing, relatedBottling, relatedSites, selectedId, priorFocusId: relatedBottling?.id || null, bottleTotal: sites.reduce((sum, site) => sum + site.bottleCount, 0)};
}
