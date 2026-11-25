/** Shelf details show all rows of bottles, not just the front-facing row. */
import {t, formatNumber} from '../i18n/index.js';
import {actionToolbar} from '../ui/content.js';
import {
  bottleSymbol, bottleLabel, bottleListFacts, bottleActionButtons,
  safe
} from './warehouse-presentation.js';

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
  const bottlingById = new Map((bottlings || []).map(bottling =>
    [bottling.id, bottling]));
  for (const room of warehouse?.rooms ||
    []) for (const furniture of room.furniture ||
      []) for (const shelf of furniture.shelves || []) {
        if (shelf.id !== shelfId) continue;
        if (shelf.capacity === 0) return {unavailable: true};
        const bottles = (warehouse.bottles || []).filter(b =>
          warehouse.assignments?.[b.id] === shelfId)
          .sort((a, b) => bottleLabel(a).localeCompare(bottleLabel(b),
            undefined,
            {numeric: true}
          ));
        const body = bottles.length ?
          `<div class="warehouse-shelf-detail-grid">${bottles.map(b => {
            const bottling = bottlingById.get(b.bottlingId);
            const statusKey = STATUS_KEYS[b.status];
            const facts = [
              [t('forms.bottle.inventoryNumber'), b.number || null],
              [
                t('forms.bottling.abv'),
                bottling?.abv == null || bottling.abv === '' ? null :
                  `${formatNumber(bottling.abv)} % Vol.`,
              ],
              [t('forms.bottle.statusLabel'), statusKey ? t(statusKey) : null],
            ].filter(([, value]) => value != null && value !== '')
              .map(([label, value]) =>
                `<span class="warehouse-bottle-fact"><span \
class="warehouse-bottle-fact-label">${safe(label)}:</span> ${safe(value)}</s\
pan>`).join('');
            return `<article class="warehouse-shelf-detail-bottle" \
data-bottle-id="${safe(b.id)}">
                ${bottleSymbol(b, {placeholderImage: true, staticImage: true})}
                <div class="warehouse-shelf-detail-info"><strong>${safe(b.name
            )}</strong><div class="warehouse-bottle-facts">${facts}${
bottleListFacts(b)}</div></div>
                ${actionToolbar(
              bottleActionButtons(b),
              {className: 'warehouse-shelf-detail-actions'}
            )}
             </article>`;
          }).join('')}</div>` :
          `<p class="hint">${t('warehouse.shelves.empty')}</p>`;
        return {
          title: `${room.name} / ${furniture.name} / ${shelf.name}`,
          count: bottles.length,
          html: `<div class="warehouse-shelf-details"><p>${t(
            'warehouse.shelves.bottleCount', {count: bottles.length}
          )}</p>${body}</div>`,
        };
      }
  return null;
}
