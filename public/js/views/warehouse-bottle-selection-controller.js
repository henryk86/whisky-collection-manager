import {t} from '../i18n/index.js';
import {toast} from '../ui/notifications.js';
import {materialize} from '../ui/dom-renderer.js';
import {unassignedWallPage} from '../domain/warehouse-unassigned-tray.js';
import {renderUnassignedTrayPage} from './warehouse-unassigned-tray.js';

/**
 * Manages bottle selection and the independently paginated unassigned tray.
 * @param {!Object} options Warehouse state and modal/DOM callbacks.
 * @return {!Object} Bottle selection operations and tray preferences.
 */
export function createWarehouseBottleSelection({state, w, attachBottlePhotos, openBottlePreview, openForm}) {
  let unassignedWallQuery = '';
  let unassignedWallPageNumber = 1;
  let unassignedWallExpanded = false;
  /**
   * Filters records according to the selected bottle ids selection rules.
   * @return {*} Entries that meet the selection criteria.
   */
  const selectedBottleIds = () => (state.warehouseSelectedBottleIds || []).filter(id => w()?.bottles?.some(b => b.id === id));

  /**
   * Builds the localized sync bottle selection text for the current language.
   */
  function syncBottleSelection() {
    const selected = new Set(selectedBottleIds());
    document.querySelectorAll('.warehouse-bottle-check').forEach(input => {
      input.checked = selected.has(input.dataset.id);
    });
    document.querySelectorAll('.warehouse-wall-bottle .warehouse-bottle-symbol').forEach(button => {
      const checked = selected.has(button.dataset.id);
      button.setAttribute('aria-pressed', String(checked));
      const label = checked ? button.dataset.deselectLabel : button.dataset.selectLabel;
      if (label) {
        button.setAttribute('aria-label', label); button.title = label;
      }
      button.closest('.warehouse-wall-bottle')?.classList.toggle('is-selected', checked);
    });
    document.querySelectorAll('.warehouse-bottles-preview-selected').forEach(button => {
      button.disabled = selected.size !== 1;
      button.textContent = t('warehouse.bottles.detailsTitle');
    });
    document.querySelectorAll('.warehouse-bottle-selection-count').forEach(label => {
      label.textContent = t('warehouse.bottles.bulkSelected', {count: selected.size});
    });
    document.querySelectorAll('.warehouse-bottles-select-clear,.warehouse-bottles-assign-selected').forEach(button => {
      button.disabled = selected.size === 0;
    });
  }

  /**
   * Updates the selected-bottle set and refreshes selection controls.
   *
   * @param {*} id Identifier of the affected record.
   * @param {boolean} checked Whether the physical bottle should be selected.
   */
  function toggleBottleSelection(id, checked) {
    if (!w()?.bottles?.some(bottle => bottle.id === id)) return;
    const ids = new Set(selectedBottleIds());
    if (checked) ids.add(id); else ids.delete(id);
    state.warehouseSelectedBottleIds = [...ids];
    syncBottleSelection();
  }

  /**
   * Performs the refresh unassigned tray lifecycle action.
   */
  function refreshUnassignedTray() {
    const results = typeof document === 'undefined' ? null : document.querySelector?.('.warehouse-unassigned-results');
    if (!results || !w()) return;
    const data = unassignedWallPage(w(), {query: unassignedWallQuery, page: unassignedWallPageNumber});
    unassignedWallPageNumber = data.page;
    const template = materialize(renderUnassignedTrayPage(w(), selectedBottleIds(), {query: unassignedWallQuery, page: data.page}), document);
    const updated = template.firstElementChild;
    // Patch only the changing results and pagination. The search input stays
    // mounted, so typing does not lose focus or its caret position.
    for (const selector of [
      '.warehouse-unassigned-grid',
      '.warehouse-unassigned-page-summary',
      '.warehouse-unassigned-page-controls',
    ]) {
      results.querySelector(selector)?.replaceWith(updated.querySelector(selector));
    }
    attachBottlePhotos();
    syncBottleSelection();
  }

  /**
   * Updates unassigned wall search in the current state.
   *
   * @param {*} query Search query or filter conditions.
   */
  function setUnassignedWallSearch(query) {
    unassignedWallQuery = String(query ?? '');
    unassignedWallPageNumber = 1;
    refreshUnassignedTray();
  }

  /**
   * Calculates the step unassigned wall page numeric value.
   *
   * @param {number} delta Signed number of pages to move in the unassigned bottle tray.
   */
  function stepUnassignedWallPage(delta) {
    const data = unassignedWallPage(w(), {query: unassignedWallQuery, page: unassignedWallPageNumber});
    unassignedWallPageNumber = Math.min(data.pages, Math.max(1, data.page + delta));
    refreshUnassignedTray();
  }

  /**
   * Updates the toggle wall bottle selection state for its caller.
   *
   * @param {*} id Identifier of the affected record.
   */
  function toggleWallBottleSelection(id) {
    toggleBottleSelection(id, !selectedBottleIds().includes(id));
  }

  /**
   * Opens the inspection view for the currently selected bottle when available.
   */
  function previewSelectedBottle() {
    if (selectedBottleIds().length !== 1) return;
    const id = selectedBottleIds()[0];
    // Single-bottle details always open independently of shelf assignment.
    openBottlePreview(id);
  }

  /**
   * Removes or resets bottle selection.
   */
  function clearBottleSelection() {
    state.warehouseSelectedBottleIds = [];
    syncBottleSelection();
  }

  /**
   * Selects all bottles matching the input.
   */
  function selectAllBottles() {
    state.warehouseSelectedBottleIds = [...new Set([...selectedBottleIds(),
    ...[...document.querySelectorAll('.warehouse-bottle-row:not([hidden]) .warehouse-bottle-check')].map(
      input => input.dataset.id)])];
    syncBottleSelection();
  }

  /**
   * Builds the localized assign selected bottles text for the current language.
      * @return {*} Result of this expression.
*/
  function assignSelectedBottles() {
    if (!selectedBottleIds().length) return toast(t('warehouse.bottles.bulkNothingSelected'), true);
    openForm('assign-bulk');
  }


  /** Attaches the expand/collapse action to the current tray. */
  function attachUnassignedTray() {
    document.querySelector('.warehouse-unassigned-toggle')?.addEventListener('click', event => {
      unassignedWallExpanded = !unassignedWallExpanded;
      event.currentTarget.setAttribute('aria-expanded', String(unassignedWallExpanded));
      const tray = document.querySelector('.warehouse-unassigned-tray--embedded');
      if (tray) tray.hidden = !unassignedWallExpanded;
    });
  }

  /**
   * Returns the current independent search and pagination preferences.
   * @return {!Object} Tray display options.
   */
  function trayOptions() {
    return {query: unassignedWallQuery, page: unassignedWallPageNumber, expanded: unassignedWallExpanded};
  }
  return {selectedBottleIds, toggleBottleSelection, toggleWallBottleSelection, previewSelectedBottle, clearBottleSelection, selectAllBottles, assignSelectedBottles, setUnassignedWallSearch, stepUnassignedWallPage, attachUnassignedTray, trayOptions};
}
