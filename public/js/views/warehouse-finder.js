import {composeMarkup} from '../ui/render-plan.js';
/** Compact results for locating an actual physical bottle, not bulk editing. */
import {t} from '../i18n/index.js';
import {imageUrl} from '../ui/format.js';
import {routeUrl} from '../navigation/routes.js';
import {safe} from './warehouse-presentation.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates(
  new URL('./templates/warehouse-finder.html', import.meta.url));


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
    renderTemplate('warehouseFinderSummary', {
      safe: safe(total ?
        t('warehouse.find.matches', {count: total}) :
        t('warehouse.find.noMatches')),
    });
  const cards = composeMarkup(items.map(({bottle, place}) => {
    const photo = bottle.photoPath
      ? renderTemplate('img', {
        safe: safe(imageUrl(bottle.photoPath)),
      })
      : renderTemplate('img2');
    const inventory = bottle.number ? `#${safe(bottle.number)} · ` : '';
    const status = statusKeys[bottle.status] ?
      safe(t(statusKeys[bottle.status])) : '';
    const volume = bottle.volumeMl != null ? `${safe(bottle.volumeMl)} ml` : '';
    const type = bottle.volumeType === 'sample' ?
      safe(t('forms.bottle.sampleBottle')) : '';
    const meta = [volume, type, status].filter(Boolean).join(' · ');
    const details = bottle.bottlingId
      ? renderTemplate('smallButton', {
        safe: safe(routeUrl('detail',
          bottle.bottlingId)),
        safe2: safe(bottle.bottlingId
        ),
        safe3: safe(bottle.id),
      }) : '';
    return renderTemplate('warehouseFinderCard', {
      safe: safe(
        bottle.id),
      photo: photo,
      inventory: inventory,
      safe2: safe(
        bottle.name),
      warehouseFinderMeta: meta ?
        renderTemplate('warehouseFinderMeta', {
          meta: meta,
        }) : '',
      span: place ?
        renderTemplate('cardsSpan', {
          safe: safe(place.label),
        }) :
        safe(t('detail.fields.unassigned')),
      warehouseFindLocation: place ?
        renderTemplate('warehouseFindLocation', {
          safe: safe(bottle.id),
        }) : '',
      safe3: safe(bottle.id),
      t: t(place ? 'warehouse.bottles.relocat\
e' : 'warehouse.find.assignLocation'),
      details: details,
    });
  })) || renderTemplate('hint');
  const pagination = pages > 1 ?
    renderTemplate('warehouseFinderPages', {
      safe: safe(t(
        'warehouse.find.pagination')),
      disabled: page <= 1 ? 'disabled' : '',
      safe2: safe(t('warehouse.find.page', {page, pages})),
      disabled2: page >= pages ? 'disabled' : '',
    }) : '';
  return renderTemplate('renderWarehouseFinderResults', {
    count: count,
    cards: cards,
    pagination: pagination,
  });
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
  return renderTemplate('warehouseFinder', {
    safe: safe(query),
    filters: composeMarkup(filters.map(([id, key]) =>
      renderTemplate('warehouseFinderFilterOption', {
        id: id,
        checked: id === placement ? 'checke\
d' : '',
        t: t(key),
      }))),
    warehouseFinderResults: renderWarehouseFinderResults(
      results),
  });
}
