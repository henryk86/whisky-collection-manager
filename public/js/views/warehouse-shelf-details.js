import {composeMarkup} from '../ui/render-plan.js';
/** Shelf details show all rows of bottles, not just the front-facing row. */
import {t, formatNumber} from '../i18n/index.js';
import {actionToolbar} from '../ui/content.js';
import {
  bottleSymbol, bottleLabel, bottleListFacts, bottleActionButtons,
  safe
} from './warehouse-presentation.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates('warehouse/warehouse-shelf-details.html');


const STATUS_KEYS = {
  closed: 'home.status.closed',
  open: 'analytics.inventory.openedStatus',
  empty: 'home.status.empty',
};

/**
 * Use the already loaded collection for bottling ABV; warehouse assignments
 * intentionally do not duplicate bottling data in their storage schema.
 *
 * @param {!Object} warehouse Warehouse model being processed.
 * @param {*} shelfId Shelf id used by this operation.
 * @param {!Array<*>=} bottlings Bottlings used by this operation.
 * @return {?Object} Computed value, or null when the input has no match.
 */
export function shelfContents(warehouse, shelfId, bottlings = []) {
  const bottlingById = new Map((bottlings || []).map(bottling => [bottling.id, bottling]));
  for (const room of warehouse?.rooms || []) for (const furniture of room.furniture || []) for (const shelf of furniture.shelves || []) {
    if (shelf.id !== shelfId) continue;
    if (shelf.capacity === 0) return {unavailable: true};
    const bottles = (warehouse.bottles || []).filter(b => warehouse.assignments?.[b.id] === shelfId).sort((a, b) => bottleLabel(a).localeCompare(bottleLabel(b), undefined, {numeric: true}));
    const body = bottles.length ?
      renderTemplate('warehouseShelfDetailGrid', {
        bottles: composeMarkup(bottles.map(b => {
          const bottling = bottlingById.get(b.bottlingId);
          const statusKey = STATUS_KEYS[b.status];
          const facts = composeMarkup([
            [t('forms.bottle.inventoryNumber'), b.number || null],
            [
              t('forms.bottling.abv'),
              bottling?.abv == null || bottling.abv === '' ? null : `${formatNumber(bottling.abv)} % Vol.`,
            ],
            [
              t('forms.bottle.statusLabel'),
              statusKey ? t(statusKey) : null,
            ],
          ].filter(([, value]) => value != null && value !== '')
            .map(([label, value]) =>
              renderTemplate('warehouseBottleFact', {
                label: safe(label),
                value: safe(value),
              })));
          return renderTemplate('warehouseShelfDetailBottle', {
            bottleId: safe(b.id),
            bottleSymbol: bottleSymbol(b, {placeholderImage: true, staticImage: true}),
            name: safe(b.name),
            facts: facts,
            bottleListFacts: bottleListFacts(b),
            actionToolbar: actionToolbar(bottleActionButtons(b), {className: 'warehouse-shelf-detail-actions'}),
          });
        })),
      }) :
      renderTemplate('hint');
    return {
      title: `${room.name} / ${furniture.name} / ${shelf.name}`,
      count: bottles.length,
      html: renderTemplate('warehouseShelfDetails', {
        bottleCount: t('warehouse.shelves.bottleCount', {count: bottles.length}),
        body: body,
      }),
    };
  }
  return null;
}
