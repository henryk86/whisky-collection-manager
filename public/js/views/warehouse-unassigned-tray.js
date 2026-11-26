import {composeMarkup} from '../ui/render-plan.js';
/**
 * Global, searchable staging area for bottles not assigned to any physical
 * shelf.
 */
import {unassignedWallPage} from '../domain/warehouse-unassigned-tray.js';
import {t} from '../i18n/index.js';
import {bottleLabel, bottleListFacts, bottleSymbol} from './warehouse-presentation.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates('warehouse/warehouse-unassigned-tray.html');


/**
 * Prepares paginated unassigned-bottle cards with selection states.
 *
 * @param {!Object} warehouse Warehouse model being processed.
 * @param {!Array<*>=} selectedIds Identifiers of bottles that should appear selected in the current tray page.
 * @param {!Object=} options3 Destructured options for this operation.
 * @return {!import('../ui/render-plan.js').RenderPlan} Paginated unassigned-bottle cards with selection states.
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
      unassignedId: String(bottle.id ?? ''),
      bottleSymbol: bottleSymbol(bottle, {selectable: true, selected: checked}),
      title: bottleLabel(bottle),
      bottleName: bottleLabel(bottle),
      warehouseUnassignedFacts: facts ? renderTemplate('warehouseUnassignedFacts', {facts: facts, }) : '',
    });
  }));
  const empty = data.total === 0 ? 'warehouse.wall.unassignedEmpty' : 'warehouse.wall.unassignedNoMatches';
  return renderTemplate('warehouseUnassignedResults', {
    cards: cards || renderTemplate('hint', {t: t(empty), }),
    unassignedShown: t('warehouse.wall.unassignedShown', {shown: data.filtered, total: data.total}),
    value: String(query ?? ''),
    placeholder: t('warehouse.wall.unassignedSearchPlaceholder'),
    ariaLabel: t('warehouse.wall.unassignedSearch'),
    disabledAttributes: data.page === 1 ? {"disabled": true} : {},
    pageOf: t('home.pagination.pageOf', {page: data.page, total: data.pages}),
    nextDisabled: data.page === data.pages ? {"disabled": true} : {},
  });
}

/**
 * Prepares unassigned-bottle tray with count, search and current page.
 *
 * @param {!Object} warehouse Warehouse model being processed.
 * @param {!Array<*>=} selectedIds Identifiers of bottles selected for assignment or relocation.
 * @param {!Object=} options Optional configuration for the operation.
 * @return {!import('../ui/render-plan.js').RenderPlan} Unassigned-bottle tray with count, search and current page.
 */
export function renderUnassignedTray(warehouse, selectedIds = [],
  options = {}) {
  const total = unassignedWallPage(warehouse).total;
  const label = t('warehouse.wall.unassignedTitle', {count: total});
  const content = renderTemplate('warehouseUnassignedContent', {
    unassignedTrayPage: renderUnassignedTrayPage(warehouse, selectedIds, options),
  });
  // Inside a room wall, the staging tray shares the selection toolbar's
  // single header. Keep a standalone native disclosure for other callers.
  if (options.embedded)
    return renderTemplate('warehouseWallUnassignedContent', {
      label: label,
      hiddenAttributes: options.expanded ? {} : {"hidden": true},
      content: content,
    });
  return renderTemplate('warehouseUnassignedTray', {
    openAttributes: options.expanded ? {"open": true} : {},
    label: label,
    trayLabel: label,
    content: content,
  });
}
