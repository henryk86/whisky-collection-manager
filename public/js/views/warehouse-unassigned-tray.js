import {composeMarkup} from '../ui/render-plan.js';
/**
 * Global, searchable staging area for bottles not assigned to any physical
 * shelf.
 */
import {unassignedWallPage} from '../domain/warehouse-unassigned-tray.js';
import {t} from '../i18n/index.js';
import {
  bottleLabel, bottleListFacts, bottleSymbol,
  safe
} from './warehouse-presentation.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates(new URL('./templates/warehouse-unassigned-tray.html', import.meta.url));


/**
 * Renders unassigned tray page for warehouse unassigned tray.
 *
 * @param {!Object} warehouse Warehouse model being processed.
 * @param {!Array<*>=} selectedIds Selected ids used by this operation.
 * @param {!Object=} options3 Destructured options for this operation.
 * @return {string} Resulting text.
 */
export function renderUnassignedTrayPage(warehouse, selectedIds = [],
  {query = '', page = 1} = {}) {
  const data = unassignedWallPage(warehouse, {query, page});
  const selected = new Set(selectedIds);
  const cards = composeMarkup(data.items.map(bottle => {
    const checked = selected.has(bottle.id);
    const facts = bottleListFacts(bottle);
    return renderTemplate('warehouseUnassignedBottle', {
      checked: checked ? ' is-selected' : '',
      safe: safe(bottle.id),
      bottleSymbol: bottleSymbol(bottle, {selectable: true, selected: checked}),
      safe2: safe(bottleLabel(bottle)),
      safe3: safe(bottleLabel(bottle)),
      warehouseUnassignedFacts: facts ? renderTemplate('warehouseUnassignedFacts', {facts: facts, }) : '',
    });
  }));
  const empty = data.total === 0 ? 'warehouse.wall.unassignedEmpty' : 'warehouse.wall.unassignedNoMatches';
  return renderTemplate('warehouseUnassignedResults', {
    cards: cards || renderTemplate('hint', {t: t(empty), }),
    unassignedShown: t('warehouse.wall.unassignedShown', {shown: data.filtered, total: data.total}),
    safe: safe(query),
    safe2: safe(t('warehouse.wall.unassignedSearchPlaceholder')),
    safe3: safe(t('warehouse.wall.unassignedSearch')),
    disabled: data.page === 1 ? 'disabled' : '',
    pageOf: t('home.pagination.pageOf', {page: data.page, total: data.pages}),
    disabled2: data.page === data.pages ? 'disabled' : '',
  });
}

/**
 * Renders unassigned tray for warehouse unassigned tray.
 *
 * @param {!Object} warehouse Warehouse model being processed.
 * @param {!Array<*>=} selectedIds Selected ids used by this operation.
 * @param {!Object=} options Optional configuration for the operation.
 * @return {string} Resulting text.
 */
export function renderUnassignedTray(warehouse, selectedIds = [],
  options = {}) {
  const total = unassignedWallPage(warehouse).total;
  const label = safe(t('warehouse.wall.unassignedTitle', {count: total}));
  const content = renderTemplate('warehouseUnassignedContent', {
    unassignedTrayPage: renderUnassignedTrayPage(warehouse, selectedIds, options),
  });
  // Inside a room wall, the staging tray shares the selection toolbar's
  // single header. Keep a standalone native disclosure for other callers.
  if (options.embedded)
    return renderTemplate('warehouseWallUnassignedContent', {
      label: label,
      expanded: options.expanded ? '' : 'hidden',
      content: content,
    });
  return renderTemplate('warehouseUnassignedTray', {
    expanded: options.expanded ? 'open' : '',
    label: label,
    label2: label,
    content: content,
  });
}
