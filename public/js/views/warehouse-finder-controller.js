

import {t} from '../i18n/index.js';
import {toast} from '../ui/notifications.js';

import {findWarehouseBottles} from '../domain/warehouse-finder.js';
import {renderWarehouseFinderResults} from './warehouse-finder.js';
import {storagePath} from './warehouse-presentation.js';

/**
 * Owns warehouse finder queries, pagination and return-to-location focus.
 * @param {!Object} options Controller dependencies.
 * @return {!Object} Public controller actions and presentation.
 */
export function createWarehouseFinderController({w, state, mountContent, navigate, rememberWallScroll}) {
  let pendingFindFocusScroll = false;

  /**
   * Derives the finder results result from the supplied values.
   * @return {*} Result computed from the supplied inputs.
   */
  function finderResults() {
    const result = findWarehouseBottles(w(), {
      query: state.warehouseSearch || '',
      placement: state.warehouseFinderPlacement || 'all',
      page: state.warehouseFinderPage || 1,
    });
    state.warehouseFinderPage = result.page;
    return result;
  }

  /**
   * Performs the refresh finder results lifecycle action.
   */
  function refreshFinderResults() {
    const host = typeof document === 'undefined' ? null : document.querySelector?.('.warehouse-finder-results');
    if (host) {
      mountContent(host, renderWarehouseFinderResults(finderResults()));
    }
  }

  /**
   * Updates finder query in the current state.
   *
   * @param {*} value Value to process.
   */
  function setFinderQuery(value) {
    state.warehouseSearch = String(value ?? '');
    state.warehouseFinderPage = 1;
    refreshFinderResults();
  }

  /**
   * Updates finder placement in the current state.
   *
   * @param {*} value Value to process.
   */
  function setFinderPlacement(value) {
    if (!['all', 'assigned', 'unassigned'].includes(value)) return;
    state.warehouseFinderPlacement = value;
    state.warehouseFinderPage = 1;
    refreshFinderResults();
  }

  /**
   * Updates the step finder page state for its caller.
   *
   * @param {*} delta Value used by this operation.
   */
  function stepFinderPage(delta) {
    state.warehouseFinderPage = (state.warehouseFinderPage || 1) + delta;
    refreshFinderResults();
  }

  /**
   * Renders bottle location in the current view.
   *
   * @param {*} id Identifier of the affected record.
   * @param {!Object=} options Options controlling the operation.
      * @return {*} Result of this expression.
*/
  function showBottleLocation(id, {returnToBottlingId = null,
    returnToFlightId = null} = {}) {
    const bottle = w()?.bottles?.find(item => item.id === id);
    const place = bottle ? storagePath(w(), w().assignments?.[id]) : null;
    if (!place) return toast(t('warehouse.find.locationUnavailable'), true);
    state.warehouseRoomId = place.room.id;
    state.warehouseFurnitureId = place.furniture.id;
    state.warehouseFindFocusBottleId = id;
    state.warehouseFindReturnBottlingId = returnToBottlingId;
    state.warehouseFindReturnFlightId = returnToFlightId;
    state.warehouseFindReturn = true;
    pendingFindFocusScroll = true;
    navigate('warehouse', 'shelves');
  }

  /**
   * Removes or resets find focus.
   */
  function clearFindFocus() {
    // Close the finder banner without navigating or rebuilding the shelf wall:
    // scrolling, bottle selections and in-progress interactions stay intact.
    state.warehouseFindReturn = false;
    state.warehouseFindFocusBottleId = null;
    state.warehouseFindReturnBottlingId = null;
    state.warehouseFindReturnFlightId = null;
    pendingFindFocusScroll = false;
    if (typeof document === 'undefined') return;
    document.querySelector?.('.warehouse-find-return')?.remove();
    document.querySelector?.('.warehouse-room-wall.has-find-focus')?.classList.remove('has-find-focus');
    document.querySelectorAll?.(
      '.warehouse-wall-bay.is-find-focus, .warehouse-wall-bottle.is-find-focus, .warehouse-wall-bottle.is-find-dimmed')
      .forEach(node => node.classList.remove('is-find-focus', 'is-find-dimmed'));
  }

  /**
   * Updates element attributes used by return to finder.
   */
  function returnToFinder() {
    const id = state.warehouseFindFocusBottleId;
    const bottlingId = state.warehouseFindReturnBottlingId;
    const flightId = state.warehouseFindReturnFlightId;
    state.warehouseFindReturn = false;
    state.warehouseFindFocusBottleId = null;
    state.warehouseFindReturnBottlingId = null;
    state.warehouseFindReturnFlightId = null;
    pendingFindFocusScroll = false;
    if (flightId) {navigate('tasting-flight', flightId); return;}
    if (bottlingId) {
      navigate('detail', bottlingId, {highlightBottleId: id});
      if (id && typeof requestAnimationFrame === 'function') requestAnimationFrame(() => {
        if (state.page === 'detail' && state.selected === bottlingId) {
          document.getElementById?.(`bottle-${id}`)?.scrollIntoView?.({
            block: 'center', behavior: 'instant',
          });
        }
      });
      return;
    }
    navigate('warehouse', 'find');
    // Navigation normally moves to the page top. Return to the actual
    // selected search result after that navigation, when it is still listed.
    if (id && typeof requestAnimationFrame === 'function') requestAnimationFrame(() => {
      if (state.page !== 'warehouse' || state.selected !== 'find') return;
      const target = [...(document.querySelectorAll?.('.warehouse-finder-card') || [])].find(node => node.dataset.bottleId === id);
      target?.scrollIntoView?.({
        block: 'center', inline: 'nearest',
        behavior: 'instant',
      });
    });
  }

  /**
   * Controls to found bottle for warehouse.
   */
  function scrollToFoundBottle() {
    if (!pendingFindFocusScroll || typeof document === 'undefined') return;
    pendingFindFocusScroll = false;
    const id = state.warehouseFindFocusBottleId;
    if (!id || typeof requestAnimationFrame !== 'function') return;
    requestAnimationFrame(() => {
      if (state.page !== 'warehouse' || state.selected !== 'shelves') return;
      const target = [...(document.querySelectorAll?.('.warehouse-wall-bottle.is-find-focus') || [])].find(node => node.querySelector?.('.warehouse-bottle-symbol')?.dataset.id === id);
      if (!target?.isConnected) return;
      const scroller = target.closest?.('.warehouse-wall-scroll');
      if (scroller?.getBoundingClientRect && target.getBoundingClientRect) {
        const outer = scroller.getBoundingClientRect();
        const inner = target.getBoundingClientRect();
        scroller.scrollLeft += inner.left - outer.left - outer.width / 2 + inner.width / 2;
        rememberWallScroll();
      }
      target.scrollIntoView?.({
        block: 'center', inline: 'nearest',
        behavior: 'instant',
      });
    });
  }

  return {finderResults, setFinderQuery, setFinderPlacement, stepFinderPage, showBottleLocation, clearFindFocus, returnToFinder, scrollToFoundBottle};
}
