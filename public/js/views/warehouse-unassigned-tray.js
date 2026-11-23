/** Global, searchable staging area for bottles not assigned to any physical shelf. */
import {unassignedWallPage} from '../domain/warehouse-unassigned-tray.js';
import {t} from '../i18n/index.js';
import {bottleLabel, bottleListFacts, bottleSymbol, safe} from './warehouse-presentation.js';

export function renderUnassignedTrayPage(warehouse, selectedIds = [], {query = '', page = 1} = {}) {
  const data = unassignedWallPage(warehouse, {query, page});
  const selected = new Set(selectedIds);
  const cards = data.items.map(bottle => {
    const checked = selected.has(bottle.id);
    const facts = bottleListFacts(bottle);
    return `<div class="warehouse-unassigned-bottle warehouse-wall-bottle${checked ? ' is-selected' : ''}" data-unassigned-id="${safe(bottle.id)}">
            ${bottleSymbol(bottle, {selectable: true, selected: checked})}
            <span class="warehouse-unassigned-name" title="${safe(bottleLabel(bottle))}">${safe(bottleLabel(bottle))}</span>
            ${facts ? `<span class="warehouse-unassigned-facts">${facts}</span>` : ''}
        </div>`;
  }).join('');
  const empty = data.total === 0 ? 'warehouse.wall.unassignedEmpty' : 'warehouse.wall.unassignedNoMatches';
  return `<div class="warehouse-unassigned-results" aria-live="polite">
        <div class="warehouse-unassigned-grid">${cards || `<p class="hint warehouse-unassigned-empty">${t(empty)}</p>`}</div>
        <div class="warehouse-unassigned-pagination">
            <span class="warehouse-unassigned-page-summary">${t('warehouse.wall.unassignedShown', {shown: data.filtered, total: data.total})}</span>
            <input type="search" id="warehouse-unassigned-wall-search" class="warehouse-unassigned-page-search" value="${safe(query)}" placeholder="${safe(t('warehouse.wall.unassignedSearchPlaceholder'))}" aria-label="${safe(t('warehouse.wall.unassignedSearch'))}" autocomplete="off">
            <div class="warehouse-unassigned-page-controls">
                <button type="button" class="btn small" data-act="warehouse-unassigned-prev" ${data.page === 1 ? 'disabled' : ''}>${t('home.pagination.previous')}</button>
                <span>${t('home.pagination.pageOf', {page: data.page, total: data.pages})}</span>
                <button type="button" class="btn small" data-act="warehouse-unassigned-next" ${data.page === data.pages ? 'disabled' : ''}>${t('home.pagination.next')}</button>
            </div>
        </div>
    </div>`;
}

export function renderUnassignedTray(warehouse, selectedIds = [], options = {}) {
  const total = unassignedWallPage(warehouse).total;
  const label = safe(t('warehouse.wall.unassignedTitle', {count: total}));
  const content = `<div class="warehouse-unassigned-content">
            ${renderUnassignedTrayPage(warehouse, selectedIds, options)}
        </div>`;
  // Inside a room wall, the staging tray shares the selection toolbar's
  // single header. Keep a standalone native disclosure for other callers.
  if (options.embedded) return `<div class="warehouse-unassigned-tray warehouse-unassigned-tray--embedded" id="warehouse-wall-unassigned-content" aria-label="${label}" ${options.expanded ? '' : 'hidden'}>${content}</div>`;
  return `<details class="warehouse-unassigned-tray" ${options.expanded ? 'open' : ''} aria-label="${label}">
        <summary class="warehouse-unassigned-summary"><strong>${label}</strong><span>${t('warehouse.wall.unassignedToggleHint')}</span></summary>
        ${content}
    </details>`;
}
