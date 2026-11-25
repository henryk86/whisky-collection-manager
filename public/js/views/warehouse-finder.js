/** Compact results for locating an actual physical bottle, not bulk editing. */
import {t} from '../i18n/index.js';
import {imageUrl} from '../ui/format.js';
import {routeUrl} from '../navigation/routes.js';
import {safe} from './warehouse-presentation.js';

const statusKeys = {
  closed: 'home.status.closed',
  open: 'analytics.inventory.openedStatus',
  empty: 'home.status.empty',
};

/**
 * Renders warehouse finder results for warehouse finder.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {string} Resulting text.
 */
export function renderWarehouseFinderResults({items, total, page, pages}) {
  const count =
    `<div class="warehouse-finder-summary" aria-live="polite">${safe(total ?
      t('warehouse.find.matches', {count: total}) :
      t('warehouse.find.noMatches'))}</div>`;
  const cards = items.map(({bottle, place}) => {
    const photo = bottle.photoPath
      ? `<img src="${safe(imageUrl(bottle.photoPath))}" alt="" loading="lazy">`
      : '<img src="/assets/photo-placeholder.svg" alt="" aria-hidden="true">';
    const inventory = bottle.number ? `#${safe(bottle.number)} · ` : '';
    const status = statusKeys[bottle.status] ?
      safe(t(statusKeys[bottle.status])) : '';
    const volume = bottle.volumeMl != null ? `${safe(bottle.volumeMl)} ml` : '';
    const type = bottle.volumeType === 'sample' ?
      safe(t('forms.bottle.sampleBottle')) : '';
    const meta = [volume, type, status].filter(Boolean).join(' · ');
    const details = bottle.bottlingId
      ? `<a class="btn small" href="${safe(routeUrl('detail',
        bottle.bottlingId))}" data-act="open" data-id="${safe(bottle.bottlingId
        )}" data-bottle-id="${safe(bottle.id)}">${t(
          'warehouse.bottles.detailsTitle')}</a>` : '';
    return `<article class="warehouse-finder-card" data-bottle-id="${safe(
      bottle.id)}">
            <div class="warehouse-finder-photo">${photo}</div>
            <div class="warehouse-finder-info"><strong>${inventory}${safe(
        bottle.name)}</strong>
                ${meta ?
        `<span class="warehouse-finder-meta">${meta}</span>` : ''}
                <span class="warehouse-finder-location">${place ?
        `<span aria-hidden="true">⌖</span> ${safe(place.label)}` :
        safe(t('detail.fields.unassigned'))}</span>
            </div>
            <div class="warehouse-finder-actions">
                ${place ?
        `<button type="button" class="btn small primary" data-act="warehouse\
-find-location" data-id="${safe(bottle.id)}">${t('warehouse.find.showLocatio\
n')}</button>` : ''}
                <button type="button" class="btn small" data-act="warehouse-\
assign" data-id="${safe(bottle.id)}">${t(place ? 'warehouse.bottles.relocat\
e' : 'warehouse.find.assignLocation')}</button>
                ${details}
            </div>
        </article>`;
  }).join('') || `<p class="hint warehouse-finder-empty">${t(
    'warehouse.bottles.noResults')}</p>`;
  const pagination = pages > 1 ?
    `<nav class="warehouse-finder-pages" aria-label="${safe(t(
      'warehouse.find.pagination'))}">
        <button type="button" class="btn small" data-act="warehouse-find-pre\
v" ${page <= 1 ? 'disabled' : ''}>${t('warehouse.find.previous')}</button>
        <span>${safe(t('warehouse.find.page', {page, pages}))}</span>
        <button type="button" class="btn small" data-act="warehouse-find-nex\
t" ${page >= pages ? 'disabled' : ''}>${t('warehouse.find.next')}</button>
    </nav>` : '';
  return `${count}<div class="warehouse-finder-list">${cards}</div>\
${pagination}`;
}

/**
 * Renders warehouse finder for warehouse finder.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {string} Resulting text.
 */
export function renderWarehouseFinder({query, placement, results}) {
  const filters = [
    ['all', 'warehouse.find.all'],
    ['assigned', 'warehouse.find.assigned'],
    ['unassigned', 'warehouse.find.unassigned'],
  ];
  return `<section class="warehouse-finder" aria-label="${t(
    'warehouse.navigation.findBottles')}">
        <label class="warehouse-finder-search-label" for="warehouse-search">\
${t('warehouse.bottles.searchInventory')}</label>
        <input id="warehouse-search" type="search" autocomplete="off" \
value="${safe(query)}" placeholder="${t('warehouse.bottles.searchPlaceholde\
r')}">
        <fieldset class="warehouse-finder-filter"><legend>${t(
      'warehouse.find.placement')}</legend>
          ${filters.map(([id, key]) =>
        `<label class="warehouse-finder-filter-option"><input type="radio" \
name="warehouse-find-placement" value="${id}" ${id === placement ? 'checke\
d' : ''}><span>${t(key)}</span></label>`).join('')}
        </fieldset>
        <div class="warehouse-finder-results">${renderWarehouseFinderResults(
          results)}</div>
    </section>`;
}
