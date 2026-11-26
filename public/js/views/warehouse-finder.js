import {composeMarkup} from '../ui/render-plan.js';
/** Compact results for locating an actual physical bottle, not bulk editing. */
import {t} from '../i18n/index.js';
import {imageUrl} from '../ui/format.js';
import {routeUrl} from '../navigation/routes.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates('warehouse/warehouse-finder.html');


const statusKeys = {
  closed: 'home.status.closed',
  open: 'analytics.inventory.openedStatus',
  empty: 'home.status.empty',
};

/**
 * Prepares warehouse search results and matching-count summary.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {!import('../ui/render-plan.js').RenderPlan} Warehouse search results and matching-count summary.
 */
export function renderWarehouseFinderResults({items, total, page, pages}) {
  const count =
    renderTemplate('warehouseFinderSummary', {
      resultSummary: String((total ? t('warehouse.find.matches', {count: total}) : t('warehouse.find.noMatches')) ?? ''),
    });
  const cards = composeMarkup(items.map(({bottle, place}) => {
    const photo = bottle.photoPath ? renderTemplate('img', {src: String(imageUrl(bottle.photoPath) ?? ''), }) : renderTemplate('img2');
    const inventory = bottle.number ? `#${String(bottle.number ?? '')} · ` : '';
    const status = statusKeys[bottle.status] ? t(statusKeys[bottle.status]) : '';
    const volume = bottle.volumeMl != null ? `${String(bottle.volumeMl ?? '')} ml` : '';
    const type = bottle.volumeType === 'sample' ? t('forms.bottle.sampleBottle') : '';
    const meta = [volume, type, status].filter(Boolean).join(' · ');
    const details = bottle.bottlingId
      ? renderTemplate('smallButton', {
        href: String(routeUrl('detail', bottle.bottlingId) ?? ''),
        id: String(bottle.bottlingId ?? ''),
        bottleId: String(bottle.id ?? ''),
      }) : '';
    return renderTemplate('warehouseFinderCard', {
      bottleId: String(bottle.id ?? ''),
      photo: photo,
      inventory: inventory,
      name: String(bottle.name ?? ''),
      warehouseFinderMeta: meta ? renderTemplate('warehouseFinderMeta', {meta: meta, }) : '',
      span: place ? renderTemplate('cardsSpan', {label: String(place.label ?? ''), }) : t('detail.fields.unassigned'),
      warehouseFindLocation: place ? renderTemplate('warehouseFindLocation', {id: String(bottle.id ?? ''), }) : '',
      id: String(bottle.id ?? ''),
      t: t(place ? 'warehouse.bottles.relocate' : 'warehouse.find.assignLocation'),
      details: details,
    });
  })) || renderTemplate('hint');
  const pagination = pages > 1 ?
    renderTemplate('warehouseFinderPages', {
      ariaLabel: t('warehouse.find.pagination'),
      disabledAttributes: page <= 1 ? {"disabled": true} : {},
      page: t('warehouse.find.page', {page, pages}),
      nextDisabled: page >= pages ? {"disabled": true} : {},
    }) : '';
  return renderTemplate('renderWarehouseFinderResults', {
    count: count,
    cards: cards,
    pagination: pagination,
  });
}

/**
 * Prepares warehouse bottle search with assignment-status filters.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {!import('../ui/render-plan.js').RenderPlan} Warehouse bottle search with assignment-status filters.
 */
export function renderWarehouseFinder({query, placement, results}) {
  const filters = [
    ['all', 'warehouse.find.all'],
    ['assigned', 'warehouse.find.assigned'],
    ['unassigned', 'warehouse.find.unassigned'],
  ];
  return renderTemplate('warehouseFinder', {
    value: String(query ?? ''),
    filters: composeMarkup(filters.map(([id, key]) =>
      renderTemplate('warehouseFinderFilterOption', {
        id: id,
        checkedAttributes: id === placement ? {"checked": true} : {},
        t: t(key),
      }))),
    warehouseFinderResults: renderWarehouseFinderResults(results),
  });
}
