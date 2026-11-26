import {composeMarkup} from '../ui/render-plan.js';
import {createShelfContentsModel} from './models/warehouse-details.js';
/** Shelf details show all rows of bottles, not just the front-facing row. */
import {t, formatNumber} from '../i18n/index.js';
import {actionToolbar} from '../ui/content.js';
import {bottleSymbol, bottleListFacts, bottleActionButtons} from './warehouse-presentation.js';
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
  const model = createShelfContentsModel(warehouse, shelfId, bottlings);
  if (!model || model.unavailable) return model;
  const {title, rows, count} = model;
  const body = rows.length ?
    renderTemplate('warehouseShelfDetailGrid', {
      bottles: composeMarkup(rows.map(({bottle: b, abv}) => {
        const statusKey = STATUS_KEYS[b.status];
        const facts = composeMarkup([
          [t('forms.bottle.inventoryNumber'), b.number || null],
          [
            t('forms.bottling.abv'),
            abv == null || abv === '' ? null : `${formatNumber(abv)} % Vol.`,
          ],
          [
            t('forms.bottle.statusLabel'),
            statusKey ? t(statusKey) : null,
          ],
        ].filter(([, value]) => value != null && value !== '')
          .map(([label, value]) =>
            renderTemplate('warehouseBottleFact', {
              label: String(label ?? ''),
              value: String(value ?? ''),
            })));
        return renderTemplate('warehouseShelfDetailBottle', {
          bottleId: String(b.id ?? ''),
          bottleSymbol: bottleSymbol(b, {placeholderImage: true, staticImage: true}),
          name: String(b.name ?? ''),
          facts: facts,
          bottleListFacts: bottleListFacts(b),
          actionToolbar: actionToolbar(bottleActionButtons(b), {className: 'warehouse-shelf-detail-actions'}),
        });
      })),
    }) :
    renderTemplate('hint');
  return {
    title,
    count,
    html: renderTemplate('warehouseShelfDetails', {
      bottleCount: t('warehouse.shelves.bottleCount', {count}),
      body: body,
    }),
  };
}
