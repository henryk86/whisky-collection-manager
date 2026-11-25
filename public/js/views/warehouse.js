import {headerActions, headingTitle, pageHeader} from '../ui/headers.js';
import {destructiveFooter} from '../ui/modal-layout.js';
import {escapeHtml as esc} from '../ui/dom.js';
import {t, tHtml} from '../i18n/index.js';
import {roomCapacity, totalCapacity} from '../domain/warehouse-capacity.js';
import {toast} from '../ui/notifications.js';
import {imageData} from '../features/photos.js';
import {request} from '../api.js';
import {sectionWorkspace} from '../ui/section-navigation.js';
import {WAREHOUSE_CAMERAS} from '../domain/warehouse-3d-model.js';
import {mountWarehouseThree} from '../ui/warehouse-three-scene.js';
import {mountWarehouseRoomPreviews} from '../ui/warehouse-room-previews.js';
import {moveFurnitureTowards} from '../../../shared/warehouse-placement.js';
import {routeUrl} from '../navigation/routes.js';
import {createFurnitureActivation}
  from '../ui/warehouse-furniture-activation.js';
import {eyeIcon, eyeOffIcon, addActionLabel, arrowLeftIcon, arrowRightIcon}
  from '../ui/action-icons.js';
import {
  renderWarehouseAssignment, mountWarehouseAssignment, assignmentPayload,
  bulkAssignmentPayload, approveShelfCapacityIncrease
}
  from '../ui/warehouse-assignment.js';
import {mountWarehouseBottleDrag} from '../ui/warehouse-bottle-drag.js';
import {renderWarehouseRoomWall} from './warehouse-room-wall.js';
import {createWarehouseRoomTransfer} from './warehouse-room-transfer.js';
import {shelfContents} from './warehouse-shelf-details.js';
import {renderUnassignedTrayPage} from './warehouse-unassigned-tray.js';
import {unassignedWallPage} from '../domain/warehouse-unassigned-tray.js';
import {findWarehouseBottles} from '../domain/warehouse-finder.js';
import {renderWarehouseFinder, renderWarehouseFinderResults}
  from './warehouse-finder.js';
import {
  FRONT_KEYS, CAMERA_KEYS, ROOM_SECTION_KEYS, typeChoices, typeName, num,
  capacityLabel, safe, count, field, choices, footer, bottleLabel,
  bottlePreview, roomOptions, storagePath, findFurniture, roomDiagram,
  shelfPanel
} from './warehouse-presentation.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates(
  new URL('./templates/warehouse.html', import.meta.url));

export {storagePath} from './warehouse-presentation.js';
/**
 * Registers bottle photos behavior.
 */
function attachBottlePhotos() {
  if (typeof document === 'undefined' || !document.querySelectorAll) return;
  document.querySelectorAll('.warehouse-bottle-photo').forEach(img => {
    /**
     * Renders if loaded in the current view.
     */
    const showIfLoaded = () => {
      if (img.naturalWidth >
        0) img.parentElement?.classList.add('has-photo');
    };
    if (img.complete) showIfLoaded();
    else img.addEventListener('load', showIfLoaded, {once: true});
  });
}

/**
 * Creates warehouse view for warehouse.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {!Object} Structured result for the caller.
 */
export function createWarehouseView({state, shell, navigate, modal, refresh}) {
  let pendingDelete = null;
  let threeHandle = null;
  let roomPreviews = null;
  let unmountBottleDrag = null;
  let threeTicket = 0;
  let unassignedWallQuery = '';
  let unassignedWallPageNumber = 1;
  let unassignedWallExpanded = false;
  let pendingFindFocusScroll = false;
  // The page is rebuilt after each successful relocation; remember the
  // *horizontal* wall viewport independently from the document scroll.
  const wallScrollByRoom = new Map();
  /**
   * Derives the remember wall scroll numeric value from its input.
   */
  function rememberWallScroll() {
    const viewport = typeof document === 'undefined' ? null :
      document.querySelector?.('.warehouse-wall-scroll');
    if (viewport?.dataset?.roomId && Number.isFinite(viewport.scrollLeft)) {
      wallScrollByRoom.set(viewport.dataset.roomId, viewport.scrollLeft);
    }
  }

  /**
   * Updates element attributes used by restore wall scroll.
   */
  function restoreWallScroll() {
    const viewport = typeof document === 'undefined' ? null :
      document.querySelector?.('.warehouse-wall-scroll');
    if (!viewport?.dataset?.roomId) return;
    const offset = wallScrollByRoom.get(viewport.dataset.roomId);
    if (offset === undefined) return;
    viewport.scrollLeft = offset;
    // After an asynchronous refresh, layout may settle in the next frame.
    if (typeof requestAnimationFrame ===
      'function') requestAnimationFrame(() => {
        if (viewport.isConnected && viewport.dataset.roomId ===
          currentRoom()?.id) viewport.scrollLeft = offset;
      });
  }

  /**
   * Derives the w result from the supplied values.
   * @return {*} Result computed from the supplied inputs.
   */
  const w = () => state.warehouse;
  const roomTransfer = createWarehouseRoomTransfer({
    modal, request,
    getWarehouse: w, refresh, toast,
  });
  /**
   * Derives the current room result from the supplied values.
   * @return {*} Result computed from the supplied inputs.
   */
  const currentRoom = () => roomOptions(w(), state.warehouseRoomId) || w()
    .rooms[0];

  /**
   * Derives the current furniture result from the supplied values.
   *
   * @param {*} room Warehouse room being inspected or modified.
   * @return {*} Result computed from the supplied inputs.
   */
  const currentFurniture = room => room?.furniture.find(f => f.id ===
    state.warehouseFurnitureId);

  /**
   * Filters records according to the selected furniture selection rules.
   *
   * @param {*} room Warehouse room being inspected or modified.
   * @return {*} Entries that meet the selection criteria.
   */
  const selectedFurniture = room => (state.warehouseSelectedFurnitureIds ||
    []).filter(id => room?.furniture.some(f => f.id === id));

  /**
   * Filters records according to the selected bottle ids selection rules.
   * @return {*} Entries that meet the selection criteria.
   */
  const selectedBottleIds = () => (state.warehouseSelectedBottleIds || [])
    .filter(id => w()?.bottles?.some(b => b.id === id));

  /**
   * Builds the localized bottle selection tools text for the current language.
   *
   * @param {boolean=} withAll Value used by this operation.
   * @return {string} Resulting text.
   */
  const bottleSelectionTools = (withAll = false) => {
    const total = selectedBottleIds().length;
    return renderTemplate('warehouseBottleBulkTools', {
      safe: safe(t(
        'warehouse.bottles.bulkTools')),
      safe2: safe(t('warehouse.bottles.bulkSelected', {count: total})),
      warehouseBottlesSelectAll: withAll ?
        renderTemplate('warehouseBottlesSelectAll') : '',
      total: total ? '' : 'disable\
d',
      total2: total ? '' :
        'disabled',
    });
  };

  /**
   * Builds the localized sync bottle selection text for the current language.
   */
  function syncBottleSelection() {
    const selected = new Set(selectedBottleIds());
    document.querySelectorAll('.warehouse-bottle-check').forEach(input => {
      input.checked = selected.has(input.dataset.id);
    });
    document.querySelectorAll('.warehouse-wall-bottle .warehouse-bottle-symbol'
    ).forEach(button => {
      const checked = selected.has(button.dataset.id);
      button.setAttribute('aria-pressed', String(checked));
      const label = checked ? button.dataset.deselectLabel : button.dataset
        .selectLabel;
      if (label) {
        button.setAttribute('aria-label', label); button.title =
          label;
      }
      button.closest('.warehouse-wall-bottle')?.classList.toggle('is-selected',
        checked
      );
    });
    document.querySelectorAll('.warehouse-bottles-preview-selected')
      .forEach(button => {
        button.disabled = selected.size !== 1;
        button.textContent = t('warehouse.bottles.detailsTitle');
      });
    document.querySelectorAll('.warehouse-bottle-selection-count')
      .forEach(label => {
        label.textContent =
          t('warehouse.bottles.bulkSelected', {count: selected.size});
      });
    document.querySelectorAll(
      '.warehouse-bottles-select-clear,.warehouse-bottles-assign-selected')
      .forEach(button => {
        button.disabled = selected.size === 0;
      });
  }

  /**
   * Derives the toggle bottle selection result from the supplied values.
   *
   * @param {*} id Identifier of the affected record.
   * @param {*} checked Value used by this operation.
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
    const results = typeof document === 'undefined' ? null :
      document.querySelector?.('.warehouse-unassigned-results');
    if (!results || !w()) return;
    const data = unassignedWallPage(
      w(),
      {query: unassignedWallQuery, page: unassignedWallPageNumber}
    );
    unassignedWallPageNumber = data.page;
    const template = document.createElement('template');
    template.innerHTML = renderUnassignedTrayPage(
      w(),
      selectedBottleIds(),
      {query: unassignedWallQuery, page: data.page}
    );
    const updated = template.content.firstElementChild;
    // Patch only the changing results and pagination. The search input stays
    // mounted, so typing does not lose focus or its caret position.
    for (const selector of [
      '.warehouse-unassigned-grid',
      '.warehouse-unassigned-page-summary',
      '.warehouse-unassigned-page-controls',
    ]) {
      results.querySelector(selector)?.replaceWith(updated.querySelector(
        selector));
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
   * @param {*} delta Value used by this operation.
   */
  function stepUnassignedWallPage(delta) {
    const data = unassignedWallPage(
      w(),
      {query: unassignedWallQuery, page: unassignedWallPageNumber}
    );
    unassignedWallPageNumber = Math.min(data.pages, Math.max(1, data.page +
      delta));
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
   * Derives the preview selected bottle result from the supplied values.
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
    ...[...document.querySelectorAll(
      '.warehouse-bottle-row:not([hidden]) .warehouse-bottle-check')].map(
        input => input.dataset.id)])];
    syncBottleSelection();
  }

  /**
   * Builds the localized assign selected bottles text for the current language.
      * @return {*} Result of this expression.
*/
  function assignSelectedBottles() {
    if (!selectedBottleIds()
      .length) return toast(t('warehouse.bottles.bulkNothingSelected'), true);
    openForm('assign-bulk');
  }

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
    const host = typeof document === 'undefined' ? null :
      document.querySelector?.('.warehouse-finder-results');
    if (host) host.innerHTML = renderWarehouseFinderResults(finderResults());
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
    document.querySelector?.('.warehouse-room-wall.has-find-focus')?.classList
      .remove('has-find-focus');
    document.querySelectorAll?.(
      '.warehouse-wall-bay.is-find-focus, .warehouse-wall-bottle.is-find-foc\
us, .warehouse-wall-bottle.is-find-dimmed')
      .forEach(node => node.classList
        .remove('is-find-focus', 'is-find-dimmed'));
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
      if (id && typeof requestAnimationFrame ===
        'function') requestAnimationFrame(() => {
          if (state.page === 'detail' && state.selected === bottlingId) {
            document.getElementById?.(`bottle-${id}`)?.scrollIntoView?.({
              block:
                'center', behavior: 'instant',
            });
          }
        });
      return;
    }
    navigate('warehouse', 'find');
    // Navigation normally moves to the page top. Return to the actual
    // selected search result after that navigation, when it is still listed.
    if (id && typeof requestAnimationFrame ===
      'function') requestAnimationFrame(() => {
        if (state.page !== 'warehouse' || state.selected !== 'find') return;
        const target = [...(document.querySelectorAll?.(
          '.warehouse-finder-card') || [])]
          .find(node => node.dataset.bottleId === id);
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
      const target = [...(document.querySelectorAll?.(
        '.warehouse-wall-bottle.is-find-focus') || [])]
        .find(node => node.querySelector?.('.warehouse-bottle-symbol')?.dataset
          .id === id);
      if (!target?.isConnected) return;
      const scroller = target.closest?.('.warehouse-wall-scroll');
      if (scroller?.getBoundingClientRect && target.getBoundingClientRect) {
        const outer = scroller.getBoundingClientRect();
        const inner = target.getBoundingClientRect();
        scroller.scrollLeft += inner.left - outer.left - outer.width / 2 +
          inner.width / 2;
        rememberWallScroll();
      }
      target.scrollIntoView?.({
        block: 'center', inline: 'nearest',
        behavior: 'instant',
      });
    });
  }

  /**
   * Aggregates input values for the selection panel calculation.
   *
   * @param {*} room Warehouse room being inspected or modified.
   * @param {!Object=} options Options controlling the operation.
   * @return {string} Resulting text.
   */
  function selectionPanel(room, {isolate = false, compact = false, layoutOnly =
    false} = {}) {
    if (!room.furniture.length) return renderTemplate('hint');
    const selected = new Set(selectedFurniture(room));
    const hiddenIds = new Set(state.warehouseHiddenFurnitureIds || []);
    return renderTemplate('warehouseBulkPanel', {
      compact: compact ?
        ' warehouse-bulk-panel--sidebar' : '',
      layoutOnly: layoutOnly ?
        t("warehouse.furniture.plural") :
        t("warehouse.selection.instructions"),
      span: layoutOnly ?
        renderTemplate('selectionPanelSpan', {
          length: room.furniture.length,
        }) :
        renderTemplate('warehouseBulkCount', {
          count: t(
            "warehouse.selection.count",
            {selected: selected.size, total: room.furniture.length}
          ),
        }),
      warehouseShowAll: isolate ?
        renderTemplate('warehouseShowAll', {
          some: room.furniture.some(item =>
            hiddenIds.has(item.id)) ? '' :
            'disabled',
        }) :
        '',
      furniture: room.furniture.map(furniture => {
        const occupied = furniture.shelves.reduce((n, shelf) => n +
          count(w(), shelf.id), 0);
        const visible = !hiddenIds.has(furniture.id);
        const actionLabel = t(
          "warehouse.visibility.accessibleLabel",
          {
            name: furniture.name,
            action: t(visible ? "warehouse.visibility.hide" :
              "warehouse.visibility.show"),
          }
        );
        const name = safe(furniture.name);
        const summary = t(
          "warehouse.furniture.summary",
          {
            type: safe(typeName(furniture.type)),
            shelves: furniture.shelves.length,
            bottles: occupied,
          }
        );
        const furnitureControl = layoutOnly
          ? renderTemplate('warehouseSelectFurniture', {
            safe: safe(furniture.id),
            name: name,
            warehouseFurnitureId: state.warehouseFurnitureId ===
              furniture.id ? 'aria-c\
urrent="true"' : '',
            name2: name,
            summary: summary,
          })
          : renderTemplate('warehouseToggleFurniture', {
            safe: safe(furniture.id),
            has: selected.has(furniture.id),
            safe2: safe(t(
              'warehouse.furniture.selectForBulkEdit',
              {name: furniture.name}
            )),
            name: name,
            summary: summary,
          });
        return renderTemplate('warehouseBulkItem', {
          content: !layoutOnly &&
            selected.has(furniture.id) ? ' is-selected' :
            '',
          warehouseFurnitureId: state.warehouseFurnitureId === furniture.id &&
            layoutOnly ? ' is-current' : '',
          isolate: isolate && !visible ?
            ' is-hidden' : '',
          furnitureControl: furnitureControl,
          warehouseVisibilityToggle: isolate ?
            renderTemplate('warehouseVisibilityToggle', {
              safe: safe(furniture.id),
              visible: visible,
              safe2: safe(actionLabel),
              safe3: safe(actionLabel),
              visible2: visible ? eyeIcon : eyeOffIcon,
            }) : '',
        });
      }).join(''),
      layoutOnly2: layoutOnly ? '' :
        renderTemplate('warehouseBulkSelectAll', {
          size: selected.size ?
            '' : 'disabled',
          size2: selected.size ? '' :
            'disabled',
          deleteAction: t(
            "warehouse.bulk.deleteAction", {count: selected.size}
          ),
          size3: selected.size ? '' :
            'disabled',
          editAction: t("warehouse.bulk.editAction", {count: selected.size}),
        }),
    });
  }

  /**
   * Updates furniture visibility in the current state.
   *
   * @param {*} furniture Warehouse furniture record being modified.
   * @param {*} visible Value used by this operation.
   */
  function setFurnitureVisibility(furniture, visible) {
    for (const button of document.querySelectorAll('.warehouse-bulk-visibility'
    )) {
      if (button.dataset.id !== furniture.id) continue;
      const label = t(
        "warehouse.visibility.accessibleLabel",
        {
          name: furniture.name,
          action: t(visible ? "warehouse.visibility.hide" :
            "warehouse.visibility.show"),
        }
      );
      button.setAttribute('aria-pressed', String(visible));
      button.setAttribute('aria-label', label);
      button.title = label;
      button.innerHTML = visible ? eyeIcon : eyeOffIcon;
      button.closest('.warehouse-bulk-item')?.classList.toggle('is-hidden',
        !visible
      );
    }
    threeHandle?.setFurnitureVisible?.(furniture.id, visible);
  }

  /**
   * Updates show all button in the current state.
   *
   * @param {*} room Warehouse room being inspected or modified.
   */
  function updateShowAllButton(room) {
    const button = document.querySelector?.('.warehouse-show-all');
    if (button) button.disabled = !room.furniture.some(item =>
      (state.warehouseHiddenFurnitureIds || []).includes(item.id));
  }

  /**
   * Derives the toggle furniture visibility result from the supplied values.
   *
   * @param {*} id Identifier of the affected record.
   * @return {boolean} Whether the operation matched or succeeded.
   */
  function toggleFurnitureVisibility(id) {
    const room = currentRoom();
    const furniture = room?.furniture.find(item => item.id === id);
    if (!furniture) return false;
    const hidden = new Set(state.warehouseHiddenFurnitureIds || []);
    if (hidden.has(id)) hidden.delete(id); else hidden.add(id);
    state.warehouseHiddenFurnitureIds = [...hidden];
    const visible = !hidden.has(id);
    setFurnitureVisibility(furniture, visible);
    updateShowAllButton(room);
    return visible;
  }

  /**
   * Renders all furniture in the current view.
   * @return {*} Entries that meet the selection criteria.
   */
  function showAllFurniture() {
    const room = currentRoom();
    if (!room) return 0;
    const hidden = new Set(state.warehouseHiddenFurnitureIds || []);
    const hiddenHere = room.furniture.filter(item => hidden.has(item.id));
    for (const furniture of hiddenHere) {
      hidden.delete(furniture.id);
      setFurnitureVisibility(furniture, true);
    }
    state.warehouseHiddenFurnitureIds = [...hidden];
    updateShowAllButton(room);
    return hiddenHere.length;
  }

  /**
   * Updates the DOM elements managed by sync bulk controls.
   *
   * @param {*=} room Warehouse room being inspected or modified.
   */
  function syncBulkControls(room = currentRoom()) {
    const count = selectedFurniture(room).length;
    const label = document.querySelector('.warehouse-bulk-count');
    if (label) label.textContent = t(
      "warehouse.selection.count",
      {selected: count, total: room?.furniture.length ?? 0}
    );
    const edit = document.querySelector('.warehouse-bulk-edit-btn');
    if (edit) {
      edit.disabled = count === 0; edit.textContent =
        t("warehouse.bulk.editAction", {count});
    }
    const remove = document.querySelector('.warehouse-bulk-delete-btn');
    if (remove) {
      remove.disabled = count === 0; remove.textContent =
        t("warehouse.bulk.deleteAction", {count});
    }
    const clear = document.querySelector('.warehouse-bulk-clear-btn');
    if (clear) clear.disabled = count === 0;
    const selected = new Set(selectedFurniture(room));
    document.querySelectorAll('.warehouse-bulk-pick').forEach(button => {
      const pressed = selected.has(button.dataset.id);
      button.setAttribute('aria-pressed', String(pressed));
      button.closest('.warehouse-bulk-item')?.classList.toggle('is-selected',
        pressed
      );
    });
  }

  /**
   * Derives the toggle furniture selection result from the supplied values.
   *
   * @param {*} id Identifier of the affected record.
   * @param {*} checked Value used by this operation.
   */
  function toggleFurnitureSelection(id, checked) {
    const room = currentRoom();
    if (!room?.furniture.some(item => item.id === id)) return;
    const set = new Set(selectedFurniture(room));
    if (checked) set.add(id); else set.delete(id);
    state.warehouseSelectedFurnitureIds = [...set];
    syncBulkControls(room);
  }

  /**
   * Updates the toggle furniture bulk selection state for its caller.
   *
   * @param {*} id Identifier of the affected record.
   */
  function toggleFurnitureBulkSelection(id) {
    toggleFurnitureSelection(
      id,
      !selectedFurniture(currentRoom()).includes(id)
    );
  }

  /**
   * Selects all furniture matching the input.
   */
  function selectAllFurniture() {
    const room = currentRoom();
    if (!room) return;
    state.warehouseSelectedFurnitureIds = room.furniture.map(item => item.id);
    syncBulkControls(room);
  }

  /**
   * Removes or resets furniture selection.
   */
  function clearFurnitureSelection() {
    state.warehouseSelectedFurnitureIds = [];
    syncBulkControls();
  }

  /**
   * Renders the warehouse state.
   *
   * @return {*} Structured result assembled from the input data.
   */
  function render() {
    rememberWallScroll();
    unmountBottleDrag?.();
    unmountBottleDrag = null;
    threeHandle?.dispose();
    threeHandle = null;
    roomPreviews?.dispose();
    roomPreviews = null;
    const currentTicket = ++threeTicket;
    const data = w();
    if (!data) return shell(renderTemplate('hint2'));
    const section = state.selected || 'overview';
    if (section === 'find') {
      state.warehouseFindReturn =
        false; state.warehouseFindFocusBottleId =
          null; state.warehouseFindReturnBottlingId =
            null; state.warehouseFindReturnFlightId = null;
    }
    const total = data.bottles.length;
    const assigned = data.bottles.filter(b => !!data.assignments[b.id]).length;
    const overallCapacity = totalCapacity(data);
    let content = '';
    if (section === 'overview') {
      content =
        renderTemplate('stats', {
          length: data.rooms
            .length,
          reduce: data.rooms.reduce(
            (n, r) => n + r.furniture.length,
            0),
          assigned: assigned,
          total: total,
          unlimited: overallCapacity.unlimited ? ` ${t(
            'warehouse.capacity.unlimitedExtra',
            {count: overallCapacity.unlimited}
          )}` : '',
          shelves: overallCapacity.shelves === 0 ? '–' :
            overallCapacity.unlimited && overallCapacity.defined === 0 ?
              t('warehouse.capacity.open') :
              `${overallCapacity.defined}${
overallCapacity.unlimited ? '+' :
                ''}`,
          headingTitle: headingTitle({
            title:
              t('warehouse.rooms.yourRooms'),
          }
          ),
          rooms: data.rooms.map(room => {
            const cap =
              roomCapacity(room, data);
            return renderTemplate('warehouseSelectRoom', {
              safe: safe(room.id),
              safe2: safe(room.id),
              safe3: safe(room.name),
              furnitureAndDimensions: t(
                "warehouse.rooms.furnitureAndDimensions",
                {
                  count: room.furniture.length,
                  width: num(room.width),
                  depth: num(room.height),
                }
              ),
              summary: t(
                "warehouse.capacity.summary",
                {capacity: capacityLabel(cap)}
              ),
              count: t("warehouse.occupancy.count",
                {count: cap.occupied}),
            });
          }).join('') ||
            renderTemplate('hint3'),
          addActionLabel: addActionLabel(t("warehouse.rooms.c\
reateWithPlus")),
          unassignedCount: t(
            "warehouse.bottles.unassignedCount",
            {count: total - assigned}
          ),
        });
    } else if (section === 'rooms' || section === 'shelves') {
      const room = currentRoom();
      const roomManagementActions = section === 'rooms'
        ? renderTemplate('warehouseRoomNew', {
          addActionLabel: addActionLabel(
            t("warehouse.rooms.addWithPlus")
          ),
          warehouseRoomEdit: room ? renderTemplate('warehouseRoomEdit', {
            safe: safe(room.id),
            safe2: safe(room.id),
          }) : '',
        })
        : '';
      content = renderTemplate('warehouseRoomToolbar', {
        rooms: data
          .rooms.map(r => renderTemplate('renderOption', {
            safe: safe(r.id),
            selected: r.id === room?.id ?
              'selected' : '',
            safe2: safe(r.name),
          })).join(
            ''),
        roomManagementActions: roomManagementActions,
      });
      if (room) {
        const furniture = currentFurniture(room);
        const cap = roomCapacity(room, data);
        const roomSummary =
          renderTemplate('warehouseRoomSummary', {
            safe: safe(room.name),
            gridDimensions: t(
              "warehouse.rooms.gridDimensions",
              {width: num(room.width), height: num(room.height)}
            ),
            capacityLabel: capacityLabel(
              cap),
            occupied: cap.occupied,
            occupied2: cap.occupied === 1 ?
              t("forms.bottle.title") : t("forms.bottle.plural"
              ),
          });
        const level = ['all', 'floor', 'elevated']
          .includes(state.warehousePlanLevel) ?
          state.warehousePlanLevel : 'all';
        const planMode = ['2d', '3d'].includes(state.warehousePlanMode) ?
          state.warehousePlanMode : '3d';
        const planCorner = WAREHOUSE_CAMERAS.some(([id]) => id ===
          state.warehousePlanCorner) ? state.warehousePlanCorner : 'nw';
        const zoom = [100, 150, 200].includes(state.warehousePlanZoom) ?
          state.warehousePlanZoom : 100;
        const viewSwitch =
          renderTemplate('warehouseViewSwitch', {
            planMode: planMode === '2d' ? ' primary' : '',
            planMode2: planMode === '2d',
            planMode3: planMode === '3d' ? ' primary' : '',
            planMode4: planMode === '3d',
          });
        const planFilter = planMode === '2d' ?
          renderTemplate('warehousePlanFilter', {
            selected: level
              === 'all' ? 'selected' : '',
            selected2: level === 'floor' ?
              'selected' : '',
            selected3: level ===
              'elevated' ? 'selected' : '',
          }) : renderTemplate('warehousePlanFilter2', {
            content: [100, 150, 200].map(z => renderTemplate(
              'planFilterOption',
              {
                z: z,
                selected: z === zoom ? 'selecte\
d' : '',
                z2: z,
              }
            )).join(''),
          });
        const cornerButtons = planMode === '3d' ?
          renderTemplate('warehouseCameraToolbar', {
            wAREHOUSECAMERAS: WAREHOUSE_CAMERAS.map(([id,
              label]) => renderTemplate('smallButton', {
                planCorner: planCorner
                  === id ? ' primary' :
                  '',
                id: id,
                planCorner2: planCorner === id,
                t: t(CAMERA_KEYS[id]),
              }))
              .join(''),
          }) : '';
        const planToolbar =
          renderTemplate('warehousePlanTools', {
            viewSwitch: viewSwitch,
            cornerButtons: cornerButtons,
            planFilter: planFilter,
            warehouseFurnitureNew: section ===
              'rooms' ?
              renderTemplate('warehouseFurnitureNew', {
                addActionLabel: addActionLabel(t('warehouse.furniture.p\
lace')),
              }) : '',
          });
        const plan = planMode === '3d' ?
          renderTemplate('warehouseThreeViewport') : roomDiagram(
            room,
            {...data, focusFurnitureId: furniture?.id},
            level
          );
        if (section === 'rooms') {
          // Room plans own spatial layout only: 2D/3D positioning,
          // camera and visibility. All furniture/shelf editing and
          // physical bottle work lives in Regale & Fächer.
          content += roomSummary + planToolbar
            + (planMode === '3d'
              ? renderTemplate('warehousePlanWorkspace', {
                plan: plan,
                selectionPanel: selectionPanel(
                  room,
                  {isolate: true, compact: true, layoutOnly: true}
                ),
              })
              : `${plan}${selectionPanel(room, {layoutOnly: true})}`)
            + renderTemplate('warehouseSectionBoundary', {
              furniture: furniture ?
                ' warehouse-plan-focus' : '',
              warehousePlanFocusInfo: furniture
                ? renderTemplate('warehousePlanFocusInfo', {
                  safe: safe(
                    furniture.name),
                  safe2: safe(typeName(furniture.type
                  )),
                  num: num(furniture.x),
                  num2: num(furniture
                    .y),
                  num3: num(furniture.elevation ?? 0),
                })
                : '',
              warehouseFurnitureManage: furniture ?
                renderTemplate('warehouseFurnitureManage', {
                  safe: safe(furniture.id),
                }) : '',
            });
        } else {
          const createButton =
            renderTemplate('warehouseFurnitureNew2', {
              safe: safe(room.id),
              addActionLabel: addActionLabel(t('warehouse.furni\
ture.place')),
            });
          const manageButton =
            renderTemplate('warehouseFurnitureBulk');
          const focusBottle = state.warehouseFindReturn ? data.bottles
            .find(b => b.id === state.warehouseFindFocusBottleId) : null;
          const focusPlace = focusBottle ?
            storagePath(data, data.assignments[focusBottle.id]) : null;
          const inRoom = focusPlace?.room.id === room.id;
          const findReturn = state.warehouseFindReturn
            ? renderTemplate('warehouseReturnFind', {
              t: t(state.warehouseFindReturnFlightId ?
                'flightPlan.backToFlight' : state
                  .warehouseFindReturnBottlingId ?
                  'warehouse.find.backToBottling' :
                  'warehouse.find.backToResults'),
              warehouseFindReturnLabel: inRoom ?
                renderTemplate('warehouseFindReturnLabel', {
                  safe: safe(t(
                    'warehouse.find.highlighted',
                    {name: bottleLabel(focusBottle), location: focusPlace.label}
                  )),
                }) :
                '',
              safe: safe(t('warehouse.find.clearHighlig\
ht')),
              safe2: safe(t('warehouse.find.clearHighlight')),
            }) : '';
          // The physical wall intentionally omits furniture without shelves.
          // Provide
          // a direct first-shelf action so a newly placed unit is not stranded.
          const withoutShelves = room.furniture.filter(item => item.shelves
            .length === 0);
          const firstShelfActions = withoutShelves.length
            ? renderTemplate('warehouseUnconfiguredFurniture', {
              withoutShelves: withoutShelves.map(item => renderTemplate(
                'warehouseUnconfiguredItem',
                {
                  safe: safe(item.name),
                  safe2: safe(item.id),
                  addActionLabel: addActionLabel(
                    t('warehouse.shelves.addWithPlus')
                  ),
                }
              )).join(''),
            })
            : '';
          content += roomSummary + findReturn
            + renderTemplate('warehouseShelvesToolbar', {
              headingTitle: headingTitle({
                title:
                  t('warehouse.navigation.shelves'),
              }),
              headerActions: headerActions(
                manageButton + createButton),
            })
            + firstShelfActions
            + renderWarehouseRoomWall(
              room,
              data,
              selectedBottleIds(),
              {
                query: unassignedWallQuery,
                page: unassignedWallPageNumber,
                expanded: unassignedWallExpanded,
                focusBottleId: inRoom ? focusBottle.id : null,
              }
            );
        }
      } else content += renderTemplate('hint4');
    } else {
      content = renderWarehouseFinder({
        query: state.warehouseSearch || '',
        placement: state.warehouseFinderPlacement || 'all',
        results: finderResults(),
      });
    }
    const warehouseTabs = ['overview', 'rooms', 'shelves', 'find'].map(id =>
      [id, t(ROOM_SECTION_KEYS[id])]);
    const workspace = sectionWorkspace(
      {
        sections: warehouseTabs.map(([id, label]) => ({id, label})),
        activeId: section,
        action: 'warehouse-section',
        itemAttribute: 'data-section',
        label: t('warehouse.rooms.storageAreas'),
        switchKind: 'warehouse',
        desktopClass: 'warehouse-tabs',
      },
      `${headingTitle({
        title: t(ROOM_SECTION_KEYS[section] || ROOM_SECTION_KEYS.overview),
        level: 2,
        className: 'analytics-section-title',
      })}${content}`
    );
    shell(renderTemplate('analyticsPage', {
      pageHeader: pageHeader({
        title: t('warehouse.page.title'),
        eyebrow: t('warehouse.page.eyebrow'),
        intro: t('warehouse.page.intro'),
        className: 'warehouse-heading',
      }),
      workspace: workspace,
    }));
    if (typeof document !== 'undefined' && typeof document.querySelector ===
      'function') {
      restoreWallScroll();

    }
    if (section === 'overview') roomPreviews =
      mountWarehouseRoomPreviews({rooms: data.rooms, warehouse: data});
    if (section === 'rooms') attachDrag();
    if (section === 'rooms' || section ===
      'shelves') attachFurnitureHover(section === 'rooms');
    if (section === 'shelves') {
      document.querySelector('.warehouse-unassigned-toggle')?.addEventListener(
        'click',
        event => {
          unassignedWallExpanded = !unassignedWallExpanded;
          event.currentTarget.setAttribute(
            'aria-expanded',
            String(unassignedWallExpanded)
          );
          const tray = document.querySelector(
            '.warehouse-unassigned-tray--embedded');
          if (tray) tray.hidden = !unassignedWallExpanded;
        }
      );
      attachBottlePhotos();
      const panel = section === 'shelves'
        ? document.querySelector('.warehouse-page') :
        document.querySelector('.warehouse-furniture-panel');
      if (panel) unmountBottleDrag = mountWarehouseBottleDrag(panel, {
        getWarehouse: w,
        onDrop: relocateBottle,
        /**
         * Retrieves dragged ids from the available state.
         *
         * @param {*} bottleId Value used by this operation.
         * @return {*} Whether the requested condition is met.
         */
        getDraggedIds: bottleId => selectedBottleIds().includes(bottleId) ?
          selectedBottleIds() : [bottleId],
        /**
         * Handles the invalid drop interaction.
         *
         * @param {*} reason Value used by this operation.
         */
        onInvalidDrop: reason => {
          if (reason === 'full') toast(t('warehouse.shelves.dragFull'), true);
        },
      });
    }
    const threeViewport = typeof document === 'undefined' ? null :
      document.querySelector('.warehouse-three-viewport');
    if (threeViewport && section === 'rooms') {
      const room = currentRoom();
      const corner = WAREHOUSE_CAMERAS.some(([id]) => id ===
        state.warehousePlanCorner) ? state.warehousePlanCorner : 'nw';
      const initialHidden = new Set(state.warehouseHiddenFurnitureIds || []);
      mountWarehouseThree(
        threeViewport,
        {
          room,
          warehouse: data,
          corner,
          zoom: state.warehousePlanZoom || 100,
          hiddenIds: [...initialHidden],
          onSelect: selectFurniture,
          onOpenShelf: openOccupiedShelfDetails,
        }
      )
        .then(handle => {
          if (threeTicket === currentTicket && threeViewport.isConnected) {
            threeHandle =
              handle; handle?.setZoom?.(state.warehousePlanZoom || 100);
            for (const furniture of room.furniture) {
              const nowHidden = (state.warehouseHiddenFurnitureIds || [])
                .includes(furniture.id);
              if (initialHidden.has(furniture.id) !==
                nowHidden) handle?.setFurnitureVisible?.(furniture.id,
                  !nowHidden);
            }
            const hovered =
              document.querySelector('.warehouse-bulk-item:hover');
            if (hovered) handle?.setHighlightedFurniture?.(hovered
              .querySelector('.warehouse-bulk-open')?.dataset.id);
          }
          else handle?.dispose?.();
        })
        .catch(error => {
          console.error(
            'Three.js-Lageransicht konnte nicht gestartet werden:',
            error
          );
          if (threeTicket === currentTicket &&
            threeViewport.isConnected) threeViewport.textContent =
              t('warehouse.view.threeUnavailable');
        });
    }
    if (section === 'shelves') scrollToFoundBottle();
  }

  /**
   * Registers furniture hover for warehouse.
   *
   * @param {*} withPlan With plan used by this operation.
   */
  function attachFurnitureHover(withPlan) {
    // The list is re-created on render; keep hover handlers local to its
    // lifetime.
    // Only the pointer/focus visual state changes: no selection, navigation or
    // WebGL rebuild.
    const list = document.querySelector('.warehouse-bulk-list');
    if (!list?.querySelectorAll) return;
    /**
     * Updates element attributes used by highlight.
     *
     * @param {*} id Identifier of the affected record.
     */
    function highlight(id) {
      if (withPlan) {
        threeHandle?.setHighlightedFurniture?.(id);
        document.querySelectorAll('.warehouse-drag').forEach(node => {
          node.classList.toggle('warehouse-hovered', node.dataset.id === id);
        });
      }
    }
    for (const tile of list.querySelectorAll('.warehouse-bulk-item')) {
      const id = tile.querySelector('.warehouse-bulk-open')?.dataset.id;
      if (!id) continue;
      tile.addEventListener('pointerenter', () => highlight(id));
      tile.addEventListener('pointerleave', () => highlight(null));
      tile.addEventListener('focusin', () => highlight(id));
      tile.addEventListener('focusout', event => {
        if (!tile.contains(event.relatedTarget)) highlight(null);
      });
    }
  }

  /**
   * Derives the update3dzoom result from the supplied values.
   *
   * @param {*} value Value to process.
   * @return {*} Result computed from the supplied inputs.
   */
  function update3DZoom(value) {return threeHandle?.setZoom(value) ?? false;}

  /**
   * Builds the localized door range row text for the current language.
   *
   * @param {!Object=} range Value used by this operation.
   * @param {number=} count Number of requested or available entries.
   * @return {string} Resulting text.
   */
  function doorRangeRow(range = {}, count = 0) {
    /**
     * Builds the localized opts text for the current language.
     *
     * @param {*} chosen Value used by this operation.
     * @return {string} Resulting text.
     */
    const opts = (chosen) => Array.from(
      {length: count},
      (_, i) => renderTemplate('optsOption', {
        i: i + 1,
        selected: chosen === i + 1 ?
          'selected' : '',
        numbered: t("warehouse.shelves.numbered", {
          index: i +
            1,
        }),
      })
    ).join('');
    return renderTemplate('warehouseDoorRange', {
      opts: opts(range.from ||
        1),
      opts2: opts(range.to ||
        count),
      selected: range
        .front !== 'glass' ? 'selected' : '',
      selected2: range.front ===
        'glass' ? 'selected' : '',
      selected3: range
        .doorLeaves == null ? 'selected' : '',
      selected4: range.doorLeaves === 1 ?
        'selected' : '',
      selected5: range
        .doorLeaves === 2 ? 'selected' :
        '',
      selected6: range
        .glassFrame == null ? 'selected' : '',
      selected7: range.glassFrame ===
        true ? 'selected' : '',
      selected8: range.glassFrame ===
        false ? 'selected' : '',
    });
  }

  /**
 * The single-furniture dialog deliberately has no navigation or bulk
 * selection.
 *
 * @param {string=} id Identifier used to select the relevant record.
 * @return {boolean} Whether the condition is satisfied.
 */
  function openFurnitureManager(id = state.warehouseFurnitureId) {
    const data = w();
    const found = id ? findFurniture(data, id) : null;
    if (!found) return false;
    state.warehouseRoomId = found.room.id;
    state.warehouseFurnitureId = found.furniture.id;
    modal.showModal(
      found.furniture.name,
      renderTemplate('warehouseFurnitureManager', {
        safe: safe(found.furniture
          .id),
        shelfPanel: shelfPanel(
          data,
          found.room,
          found.furniture,
          {managementOnly: true}
        ),
      }),
      true
    );
    attachBottlePhotos();
    return true;
  }

  /**
 * Batch changes are a separate workflow, never part of the shelf editor.
 *
 * @return {boolean} Whether the condition is satisfied.
 */
  function openFurnitureBulkManager() {
    const room = currentRoom();
    if (!room) return false;
    modal.showModal(
      t('warehouse.bulk.manageAction'),
      renderTemplate('warehouseFurnitureBulkManager', {
        selectionPanel: selectionPanel(
          room),
      }),
      true
    );
    return true;
  }

  /**
   * Performs the open shelf details lifecycle action.
   *
   * @param {*} id Identifier of the affected record.
   * @return {*} Whether the required condition is satisfied.
   */
  function openShelfDetails(id) {
    const contents = shelfContents(w(), id, state.collection?.bottlings);
    if (!contents) return toast(t('warehouse.shelves.notFound'), true);
    if (contents.unavailable) return false;
    modal.showModal(contents.title, contents.html, true, true);
    attachBottlePhotos();
    return true;
  }

  /**
 * In the 3D room plan, only occupied bays open the existing shelf modal. In
 * particular, this must neither navigate nor open furniture editing.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @return {(boolean|void)} Result of the open occupied shelf details
 * operation.
 */
  function openOccupiedShelfDetails(id) {
    const contents = shelfContents(w(), id, state.collection?.bottlings);
    if (!contents || contents.unavailable || contents.count === 0) return false;
    return openShelfDetails(id);
  }

  /**
   * Performs the open bottle preview lifecycle action.
   *
   * @param {*} id Identifier of the affected record.
      * @return {*} Result of this expression.
*/
  function openBottlePreview(id) {
    const bottle = w()?.bottles.find(entry => entry.id === id);
    if (!bottle) return toast(t('features.errors.bottleNotFound'), true);
    const bottling = state.collection?.bottlings.find(entry => entry.id ===
      bottle.bottlingId);
    const physicalBottle = bottling?.bottles.find(entry => entry.id ===
      bottle.id);
    modal.showModal(
      t('warehouse.bottles.detailsTitle'),
      bottlePreview(w(), bottle, bottling, physicalBottle)
    );
  }

  /**
   * Controls form for warehouse.
   *
   * @param {string} kind Resource kind selecting the relevant schema.
   * @param {string} id Identifier used to select the relevant record.
   * @param {!Object=} options3 Destructured options for this operation.
   * @return {void} Structured result assembled from the input data.
   */
  function openForm(kind, id, {replaceCurrent = false} = {}) {
    const data = w();
    let endpoint = '', method = 'POST', title = '', fields =
      '', shelfNavigation = '';
    if (kind === 'room') {
      const item = data.rooms.find(r => r.id === id);
      title = item ? t("warehouse.rooms.edit") : t("warehouse.rooms.create");
      endpoint = item ? `/api/warehouse/rooms/${item.id}` :
        '/api/warehouse/rooms'; method = item ? 'PATCH' : 'POST';
      fields = field('name', t("warehouse.rooms.roomName"), item?.name ||
        '') + field(
          'width',
          t("warehouse.fields.widthMeters"),
          item?.width ?? 4,
          'number',
          'step="0.01" min="1" max="100"'
        ) + field(
          'height',
          t("warehouse.fields.depthMeters"),
          item?.height ?? 4,
          'number',
          'step="0.01" min="1" max="100"'
        );
    } else if (kind === 'furniture') {
      const found = findFurniture(data, id);
      const room = found?.room || currentRoom();
      if (!room) return toast(t("warehouse.empty.createRoomFirst"), true);
      const item = found?.furniture;
      title = item ? t("warehouse.furniture.edit") :
        t("warehouse.furniture.add");
      endpoint = item ? `/api/warehouse/furniture/${item.id}` :
        `/api/warehouse/rooms/${room.id}/furniture`; method = item ?
          'PATCH' : 'POST';
      fields = field(
        'name',
        t("warehouse.fields.name"),
        item?.name || t("warehouse.furniture.defaultShelfName")
      ) + choices(
        'type',
        t("warehouse.fields.furnitureType"),
        typeChoices(),
        item?.type || 'regal'
      ) + field(
        'x',
        t("warehouse.fields.positionXMeters"),
        item?.x ?? 0,
        'number',
        'step="0.01" min="0"'
      ) + field(
        'y',
        t("warehouse.fields.positionYMeters"),
        item?.y ?? 0,
        'number',
        'step="0.01" min="0"'
      ) + field(
        'width',
        t("warehouse.fields.widthMetersShort"),
        item?.width ?? 1,
        'number',
        'min="0.2" step="0.01"'
      ) + field(
        'depth',
        t("warehouse.fields.depthMetersShort"),
        item?.depth ?? 0.5,
        'number',
        'min="0.2" step="0.01"'
      ) + choices(
        'rotation',
        t("warehouse.fields.rotation"),
        [[0, '0°'], [90, '90°'], [180, '180°'], [270, '270°']],
        item?.rotation ?? 0
      )
        + field(
          'elevation',
          t("warehouse.fields.bottomElevationMeters"),
          item?.elevation ?? 0,
          'number',
          'step="0.01" min="0" max="10"'
        )
        + field(
          'itemHeight',
          t("warehouse.fields.furnitureHeightMeters"),
          item?.itemHeight ?? (item?.type === 'haengeregal' ? 0.4 : 1.8),
          'number',
          'step="0.01" min="0.1" max="5"'
        )
        + choices(
          'doorLeaves',
          t("warehouse.walls.doorLeavesDefault"),
          [
            ['', t('warehouse.shelves.defaultWoodDoors')],
            ['1', t('warehouse.doors.singleLeaf')],
            ['2', t('warehouse.doors.doubleLeaf')],
          ],
          String(item?.doorLeaves ?? '')
        )
        + choices(
          'glassFrame',
          t("warehouse.walls.glassDoorFrameDefault"),
          [
            ['', t('warehouse.walls.withoutFrameDefault')],
            ['true', t('warehouse.walls.withFrame')],
            ['false', t('warehouse.walls.withoutFrame')],
          ],
          String(item?.glassFrame ?? '')
        )
        + (item?.shelves.length ?
          renderTemplate('warehouseDoorRanges', {
            doorRanges: (item
              .doorRanges || []).map(range => doorRangeRow(range,
                item.shelves.length)).join(
                  ''),
            addActionLabel: addActionLabel(t("warehouse.shelves.addDoorRang\
e")),
          }) : '')
        + renderTemplate('warehouseWallOptions', {
          content: [
            ['leftSidePanel', t('warehouse.walls.leftPanel'), 'left'],
            ['rightSidePanel', t('warehouse.walls.rightPanel'), 'right'],
            ['backPanel', t('warehouse.walls.backPanel'), 'back'],
          ].map(([key, label, side]) =>
            renderTemplate('warehouseWallToggle', {
              key: key,
              checked: item?.[key] === true ? 'checked' : '',
              side: side,
              label: label,
            })).join(''),
        })
        + renderTemplate('hint5');
    } else if (kind === 'furniture-bulk') {
      const room = currentRoom();
      const ids = selectedFurniture(room);
      if (!ids.length) return toast(t(
        "warehouse.validation.selectFurnitureFirst"), true);
      title = t("warehouse.bulk.editTitle", {count: ids.length});
      endpoint = '/api/warehouse/furniture/bulk'; method = 'PATCH';
      /**
       * Produces the bulk field text used by the caller.
       *
       * @param {*} control Value used by this operation.
       * @return {string} Resulting text.
       */
      const bulkField = (control) =>
        renderTemplate('warehouseBulkField', {
          control: control,
        });

      /**
       * Builds the localized optional number text for the current language.
       *
       * @param {*} key Key used to select or group values.
       * @param {*} label Label shown to the user.
       * @param {*} constraints Value used by this operation.
       * @return {string} Resulting text.
       */
      const optionalNumber = (key, label, constraints) =>
        renderTemplate('formField', {
          safe: safe(
            label),
          key: key,
          constraints: constraints,
        });
      fields = renderTemplate('hint6', {
        bulkDescription: t(
          "warehouse.selection.bulkDescription",
          {
            names: ids.map(id => room.furniture.find(f => f.id === id)?.name)
              .map(safe).join(', '),
          }
        ),
      })
        + bulkField(renderTemplate('formField2', {
          content: [[0, '0°'], [90, '90°'],
          [180, '180°'], [270, '270°']].map(([value,
            label]) => renderTemplate('openFormOption', {
              value: value,
              label: label,
            })).join(
              ''),
        }))
        + bulkField(optionalNumber(
          'elevation',
          t('warehouse.fields.bottomElevationShort'),
          'step="0.01" min="0" max="10"'
        ))
        + bulkField(optionalNumber(
          'itemHeight',
          t('warehouse.fields.heightShort'),
          'step="0.01" min="0.1" max="5"'
        ))
        + bulkField(optionalNumber(
          'width',
          t('warehouse.fields.widthShort'),
          'step="0.01" min="0.2" max="20"'
        ))
        + bulkField(optionalNumber(
          'depth',
          t('warehouse.fields.depthShort'),
          'step="0.01" min="0.2" max="20"'
        ))
        + bulkField(choices(
          'doorLeaves',
          t("warehouse.walls.doorLeavesFurnitureDefault"),
          [
            ['', t('warehouse.fields.unchanged')],
            ['1', t('warehouse.doors.singleLeaf')],
            ['2', t('warehouse.doors.doubleLeaf')],
            ['default', t('warehouse.walls.automatic')],
          ]
        ))
        + bulkField(choices(
          'glassFrame',
          t("warehouse.walls.glassDoorFrameFurnitureDefault"),
          [
            ['', t('warehouse.fields.unchanged')],
            ['true', t('warehouse.walls.withFrame')],
            ['false', t('warehouse.walls.withoutFrame')],
            ['default', t('warehouse.walls.automatic')],
          ]
        ))
        + ['leftSidePanel', 'rightSidePanel', 'backPanel'].map((key, i) =>
          bulkField(choices(
            key,
            [
              t('warehouse.walls.leftPanel'),
              t('warehouse.walls.rightPanel'),
              t('warehouse.walls.backPanel'),
            ][i],
            [
              ['', t('warehouse.fields.unchanged')],
              ['true', t('warehouse.walls.present')],
              ['false', t('warehouse.walls.absent')],
            ]
          ))).join('')
        + renderTemplate('hint7');
    } else if (kind === 'shelf') {
      let found = null;
      for (const room of data.rooms) for (const furniture of room.furniture)
        for (const shelf of furniture.shelves) if (shelf.id === id) found =
          {shelf, furniture};
      const item = found?.shelf;
      const furnitureId = found?.furniture?.id || id;
      if (item) {
        const order = found.furniture.shelves.slice().reverse();
        const index = order.findIndex(shelf => shelf.id === id);
        shelfNavigation =
          renderTemplate('warehouseShelfEditorNavigation', {
            safe: safe(order[index -
              1]?.id || ''),
            disabled: index === 0 ? 'disabled' :
              '',
            arrowLeftIcon: arrowLeftIcon,
            position: t(
              'warehouse.shelves.position',
              {current: index + 1, total: order.length}
            ),
            safe2: safe(order[index +
              1]?.id || ''),
            disabled2: index === order.length - 1 ? 'disabled' :
              '',
            arrowRightIcon: arrowRightIcon,
          });
      }
      title = item ? t("warehouse.shelves.edit") : t("warehouse.shelves.add");
      endpoint = item ? `/api/warehouse/shelves/${item.id}` :
        `/api/warehouse/furniture/${furnitureId}/shelves`; method = item ?
          'PATCH' : 'POST';
      fields = field(
        'name',
        t("warehouse.shelves.name"),
        item?.name || t(
          'warehouse.shelves.numbered',
          {
            index: (findFurniture(data, furnitureId)?.furniture.shelves
              .length || 0) + 1,
          }
        )
      )
        + renderTemplate('formField3', {
          safe: safe(item?.capacity ?? ''),
        })
        + choices(
          'front',
          t("warehouse.shelves.frontType"),
          [
            ['', t('warehouse.shelves.defaultFront')],
            ...['open', 'door', 'glass', 'drawer'].map(id =>
              [id, t(FRONT_KEYS[id])]),
          ],
          item?.front ?? ''
        )
        + choices(
          'doorLeaves',
          t("warehouse.walls.doorLeaves"),
          [
            ['', t('warehouse.fields.furnitureDefaultAutomatic')],
            ['1', t('warehouse.doors.singleLeaf')],
            ['2', t('warehouse.doors.doubleLeaf')],
          ],
          String(item?.doorLeaves ?? '')
        )
        + choices(
          'glassFrame',
          t("warehouse.walls.glassDoorFrame"),
          [
            ['', t('warehouse.fields.furnitureDefaultWithoutFrame')],
            ['false', t('warehouse.walls.withoutFrame')],
            ['true', t('warehouse.walls.withFrame')],
          ],
          String(item?.glassFrame ?? '')
        )
        + renderTemplate('formField4', {
          safe: safe(item?.heightCm ?? ''),
        })
        + renderTemplate('hint8');
    } else if (kind === 'furniture-copy') {
      const found = findFurniture(data, id);
      if (!found) return toast(t("warehouse.furniture.notFound"), true);
      title = t(
        'warehouse.furniture.copyTitle',
        {type: typeName(found.furniture.type)}
      );
      endpoint = `/api/warehouse/furniture/${safe(id)}/copy`;
      fields = field(
        'name',
        t("warehouse.furniture.copyName"),
        t("warehouse.furniture.copyNameSuffix", {name: found.furniture.name})
      )
        + choices(
          'roomId',
          t("warehouse.bottles.destinationRoom"),
          data.rooms.map(r => [r.id, r.name]),
          found.room.id
        )
        + renderTemplate('warehouseCopyOption')
        + renderTemplate('hint9');
    } else if (kind === 'shelf-copy') {
      let found = null;
      for (const room of data.rooms) for (const furniture of room.furniture)
        for (const shelf of furniture.shelves) {
          if (shelf.id === id) found = {shelf, furniture};
        }
      if (!found) return toast(t("warehouse.shelves.notFound"), true);
      title = t('warehouse.shelves.copyTitle');
      endpoint = `/api/warehouse/shelves/${safe(id)}/copy`;
      fields = field(
        'name',
        t("warehouse.furniture.copyName"),
        t("warehouse.furniture.copyNameSuffix", {name: found.shelf.name})
      )
        + choices(
          'furnitureId',
          t("warehouse.bottles.destinationFurniture"),
          data.rooms.flatMap(r => r.furniture.map(f =>
            [f.id, `${r.name} / ${f.name}`])),
          found.furniture.id
        )
        + renderTemplate('hint10');
    } else if (kind === 'assign-bulk') {
      const bottles = data.bottles.filter(b => selectedBottleIds()
        .includes(b.id));
      if (!bottles.length) return toast(t(
        'warehouse.bottles.bulkNothingSelected'), true);
      title = t('detail.fields.storageLocation');
      endpoint = '/api/warehouse/bottles/bulk'; method = 'POST';
      fields = renderWarehouseAssignment(data, bottles);
    } else if (kind === 'assign') {
      const bottle = data.bottles.find(b => b.id === id);
      if (!bottle) return toast(t("features.errors.bottleNotFound"), true);
      title = t('detail.fields.storageLocation'); endpoint =
        `/api/warehouse/bottles/${id}`; method = 'PUT';
      fields = renderWarehouseAssignment(data, bottle);
    }
    modal.showModal(
      title,
      renderTemplate('warehouseForm', {
        safe: safe(endpoint
        ),
        method: method,
        kind: kind ===
          'furniture' && !id ? 'true' : 'false',
        kind2: kind ===
          'furniture-bulk',
        kind3: kind ===
          'assign-bulk',
        includes: ['assign',
          'assign-bulk'].includes(kind) ? ' warehouse-assignment-form' :
          '',
        shelfNavigation: shelfNavigation,
        fields: fields,
        footer: footer(),
      }),
      kind === 'assign',
      replaceCurrent ? 'replace' : true,
      '',
      ['assign', 'assign-bulk'].includes(kind) ? 'assignment' : ''
    );
    const formElement = document.querySelector('#warehouse-form');
    if (formElement?.tagName === 'FORM') formElement.dataset.initialValues =
      JSON.stringify([...new FormData(formElement).entries()]);
    if (kind === 'assign' || kind === 'assign-bulk') mountWarehouseAssignment(
      document.querySelector('#warehouse-form'),
      data,
      kind === 'assign-bulk' ? selectedBottleIds() : id
    );
    const editor = document.querySelector('.warehouse-door-ranges');
    if (editor) editor.addEventListener('click', event => {
      if (event.target.closest('.warehouse-door-range-remove')) event.target
        .closest('.warehouse-door-range')?.remove();
      if (event.target.closest('.warehouse-door-range-add')) {
        const list = editor.querySelector('.warehouse-door-range-list');
        const shelfCount = findFurniture(w(), id)?.furniture.shelves
          .length || 0;
        list.insertAdjacentHTML('beforeend', doorRangeRow({}, shelfCount));
      }
    });
  }

  /**
   * Locates the DOM elements used by switch shelf.
   *
   * @param {*} id Identifier of the affected record.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function switchShelf(id) {
    if (!id) return;
    const form = document.querySelector(
      '#warehouse-form[data-endpoint^="/api/warehouse/shelves/"]');
    if (!form) return;
    const modified = JSON.stringify([...new FormData(form).entries()]) !==
      form.dataset.initialValues;
    if (modified) {
      const answer = await modal.choose(t('warehouse.shelves.unsavedTitle'),
        t('warehouse.shelves.unsavedMessage'), [
        {id: 'cancel', label: t('common.actions.cancel')},
        {id: 'discard', label: t('warehouse.shelves.discard')},
        {id: 'save', label: t('common.actions.save'), primary: true},
      ]);
      if (answer === 'cancel') return;
      if (answer === 'save') {
        if (!(await submit({
          /**
           * Updates the prevent default state for its caller.
           */
          preventDefault() {}, target: form,
        }))) return;
        openForm('shelf', id); // previous form is already closed by submit
        return;
      }
    }
    openForm('shelf', id, {replaceCurrent: true});
  }

  /**
   * Performs the refresh furniture modal lifecycle action.
   */
  function refreshFurnitureModal() {
    const manager = document.querySelector(
      '#modal-root .warehouse-furniture-manager');
    if (!manager) return;
    const found = findFurniture(w(), manager.dataset.furnitureId);
    if (!found) return;
    modal.updateContent(
      renderTemplate('warehouseFurnitureManager2', {
        safe: safe(found.furniture
          .id),
        shelfPanel: shelfPanel(
          w(),
          found.room,
          found.furniture,
          {managementOnly: true}
        ),
      }));
    attachBottlePhotos();
  }

  /**
   * Serializes upload furniture photos data to JSON.
   *
   * @param {*} id Identifier of the affected record.
   * @param {*} files Value used by this operation.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function uploadFurniturePhotos(id, files) {
    if (!files.length) return;
    try {
      for (const file of files) await request(
        `/api/warehouse/furniture/${encodeURIComponent(id)}/photos`,
        {
          method: 'POST', body: JSON.stringify({image: await imageData(file)}),
        }
      );
      await refresh(); refreshFurnitureModal();
    } catch (error) {
      toast(error.message, true); await refresh();
      refreshFurnitureModal();
    }
  }

  /**
   * Serializes move furniture photo data to JSON.
   *
   * @param {*} id Identifier of the affected record.
   * @param {*} photoId Value used by this operation.
   * @param {*} direction Direction used for traversal or movement.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function moveFurniturePhoto(id, photoId, direction) {
    const found = findFurniture(w(), id); if (!found) return;
    const order = (found.furniture.photos || []).map(photo => photo.id);
    const index = order.indexOf(photoId), target = index + Number(direction);
    if (index < 0 || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    try {
      await request(
        `/api/warehouse/furniture/${encodeURIComponent(id)}/photos/order`,
        {
          method: 'PUT', body: JSON.stringify({photoIds: order}),
        }
      );
      await refresh(); refreshFurnitureModal();
    } catch (error) {toast(error.message, true);}
  }

  /**
   * Performs the open furniture photo lifecycle action.
   *
   * @param {*} path Path to the target resource.
   * @param {*} title Title displayed or stored by this operation.
   */
  function openFurniturePhoto(path, title) {
    if (!/^images\/[\w-]+\/furniture-[\w-]+\.(?:jpg|png|webp|gif)$/
      .test(path)) return;
    modal.showModal(
      title,
      renderTemplate('warehousePhotoLightbox', {
        safe: safe(
          path),
        safe2: safe(title),
      }),
      true
    );
  }

  /**
   * Removes or resets furniture photo.
   *
   * @param {*} id Identifier of the affected record.
   * @param {*} photoId Value used by this operation.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function deleteFurniturePhoto(id, photoId) {
    if (!await modal.confirm(
      t('warehouse.photos.remove'),
      t('warehouse.photos.removeConfirm'),
      t('common.actions.remove')
    )) return;
    try {
      await request(
        `/api/warehouse/furniture/${encodeURIComponent(
          id)}/photos/${encodeURIComponent(photoId)}`,
        {method: 'DELETE'}
      );
      await refresh(); refreshFurnitureModal();
    } catch (error) {toast(error.message, true);}
  }

  /**
   * Builds the localized approve capacity increase text for the current
   * language.
   *
   * @param {*} ids Identifiers in their current order.
   * @param {*} shelfId Value used by this operation.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  const approveCapacityIncrease = (ids, shelfId) =>
    approveShelfCapacityIncrease(
      w(),
      shelfId,
      ids,
      message => modal.confirm(
        t('warehouse.assignment.increaseCapacityTitle'),
        message,
        t('warehouse.assignment.increaseCapacityAction')
      )
    );

  /**
   * Performs the submit lifecycle action.
   *
   * @param {!Event} event Event that triggered this operation.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function submit(event) {
    event.preventDefault();
    const form = event.target;
    if (form.dataset.bulk === 'true') {
      const changes = {};
      for (const key of ['rotation', 'elevation', 'itemHeight', 'width',
        'depth']) {
        const value = form.elements.namedItem(key)?.value;
        if (value !== undefined && value !== '') changes[key] = Number(value);
      }
      for (const key of ['doorLeaves', 'glassFrame']) {
        const value = form.elements.namedItem(key)?.value;
        if (value === 'default') changes[key] = null;
        else if (value !== undefined && value !== '') changes[key] = key ===
          'doorLeaves' ? Number(value) : value === 'true';
      }
      for (const key of ['leftSidePanel', 'rightSidePanel', 'backPanel']) {
        const value = form.elements.namedItem(key)?.value;
        if (value === 'true' || value === 'false') changes[key] =
          value === 'true';
      }
      if (!Object.keys(changes)
        .length) return toast(t("warehouse.validation.atLeastOneField"), true);
      const ids = selectedFurniture(currentRoom());
      if (!ids.length) return toast(t("warehouse.selection.noFurniture"), true);
      try {
        const result = await request(
          '/api/warehouse/furniture/bulk',
          {method: 'PATCH', body: JSON.stringify({ids, changes})}
        );
        modal.closeModal();
        await refresh();
        toast(t("warehouse.bulk.editedSuccess", {count: result.count}));
      } catch (err) {toast(err.message, true);}
      return;
    }
    let data = Object.fromEntries(new FormData(form).entries());
    if (form.classList.contains('warehouse-assignment-form')) {
      try {
        const ids = form.dataset.bottleBulk === 'true' ? selectedBottleIds() :
          [decodeURIComponent(form.dataset.endpoint.split('/').at(-1))];
        data = form.dataset.bottleBulk === 'true'
          ? bulkAssignmentPayload(
            ids,
            data.warehouseAssignmentMode,
            form.querySelector('[data-assignment-shelf]')?.value,
            w()
          )
          : assignmentPayload(
            data.warehouseAssignmentMode,
            form.querySelector('[data-assignment-shelf]')?.value,
            w()
          );
        const approval = await approveCapacityIncrease(ids, data.shelfId);
        if (approval ===
          null) return; // User declined; keep the form and selections.
        Object.assign(data, approval);
      } catch (error) {toast(error.message, true); return;}
    }
    for (const key of [
      'width',
      'height',
      'depth',
      'x',
      'y',
      'rotation',
      'elevation',
      'itemHeight',
    ]) if (key in data) data[key] = Number(data[key]);
    if (form.dataset.newFurniture === 'true' ||
      ['leftSidePanel', 'rightSidePanel', 'backPanel'].some(key =>
        form.elements.namedItem(key))) {
      for (const key of ['leftSidePanel', 'rightSidePanel', 'backPanel']) if (
        form.elements.namedItem(key)) data[key] = form.elements.namedItem(key)
          .checked;
    }
    if (form.elements.namedItem('doorLeaves')) data.doorLeaves =
      data.doorLeaves === '' ? null : Number(data.doorLeaves);
    if (form.elements.namedItem('glassFrame')) data.glassFrame =
      data.glassFrame === '' ? null : data.glassFrame === 'true';
    if (form.querySelector('.warehouse-door-ranges')) {
      data.doorRanges = [...form.querySelectorAll('.warehouse-door-range')]
        .map(row => ({
          from: Number(row.querySelector('.door-range-from').value),
          to: Number(row.querySelector('.door-range-to').value),
          front: row.querySelector('.door-range-front').value,
          doorLeaves: row.querySelector('.door-range-leaves').value === '' ?
            null : Number(row.querySelector('.door-range-leaves').value),
          glassFrame: row.querySelector('.door-range-frame').value === '' ?
            null : row.querySelector('.door-range-frame').value === 'true',
        }));
    }
    if ('capacity' in data) data.capacity = data.capacity === '' ? null :
      Number(data.capacity);
    if ('heightCm' in data) data.heightCm = data.heightCm === '' ? null :
      Number(data.heightCm);
    if ('front' in data) data.front = data.front || null;
    if ('shelfId' in data) data.shelfId = data.shelfId || null;
    if (form.querySelector('[name="withShelves"]')) data.withShelves =
      form.querySelector('[name="withShelves"]').checked;
    try {
      const result = await request(
        form.dataset.endpoint,
        {method: form.dataset.method, body: JSON.stringify(data)}
      );
      if (form.dataset.newFurniture === 'true' && result?.id) {
        // Keep the current room-plan tab and select the newly placed unit.
        // Its shelf manager can then be opened from the plan without routing.
        state.warehouseFurnitureId = result.id;
      }
      if (form.dataset.endpoint.endsWith('/copy')) {
        const copiedFurniture = form.querySelector('[name="withShelves"]');
        if (copiedFurniture) {
          state.warehouseRoomId = data.roomId;
          state.warehouseFurnitureId = result.id;
        } else {
          for (const room of w()
            .rooms) for (const furniture of room.furniture) if (furniture
              .id === data.furnitureId) {
              state.warehouseRoomId = room.id;
              state.warehouseFurnitureId = furniture.id;
            }
        }
      }
      modal.closeModal();
      if (form.dataset.bottleBulk ===
        'true') state.warehouseSelectedBottleIds = [];
      await refresh();
      refreshFurnitureModal(
      ); // refresh a suspended furniture manager after shelf capacity edits
      toast(form.dataset.endpoint.endsWith('/copy') ?
        t("warehouse.furniture.copiedWithoutAssignments") :
        t("warehouse.storage.saved"));
      return true;
    }
    catch (err) {toast(err.message, true);}
  }

  /**
   * Serializes relocate bottle data to JSON.
   *
   * @param {*} bottleId Value used by this operation.
   * @param {*} shelfId Value used by this operation.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function relocateBottle(bottleId, shelfId) {
    const ids = Array.isArray(bottleId) ? bottleId : [bottleId];
    let approval;
    try {approval = await approveCapacityIncrease(ids, shelfId);}
    catch (error) {toast(error.message, true); return;}
    if (approval === null) return; // Capacity stays unchanged when cancelled.
    // This action rebuilds the warehouse page after the API responds.
    // Remember the exact viewport before waiting for the server.
    rememberWallScroll();
    const previousPageY = typeof window !== 'undefined' &&
      Number.isFinite(window.scrollY) ? window.scrollY : null;
    try {
      if (Array.isArray(bottleId) && bottleId.length > 1) {
        await request('/api/warehouse/bottles/bulk', {
          method: 'POST',
          body: JSON.stringify({
            ...bulkAssignmentPayload(bottleId, 'shelf', shelfId, w()),
            ...approval,
          }),
        });
        state.warehouseSelectedBottleIds = [];
      } else {
        const id = Array.isArray(bottleId) ? bottleId[0] : bottleId;
        await request(`/api/warehouse/bottles/${encodeURIComponent(id)}`, {
          method: 'PUT', body: JSON.stringify({shelfId, ...approval}),
        });
      }
      await refresh();
      if (previousPageY !== null && typeof window.scrollTo === 'function') {
        window.scrollTo({top: previousPageY, left: 0, behavior: 'instant'});
      }
      toast(t('warehouse.shelves.dragSuccess'));
    } catch (error) {
      toast(error.message, true);
      render();
    }
  }

  /**
   * Serializes move shelf data to JSON.
   *
   * @param {*} id Identifier of the affected record.
   * @param {*} direction Direction used for traversal or movement.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function moveShelf(id, direction) {
    try {
      await request(
        `/api/warehouse/shelves/${encodeURIComponent(id)}/move`,
        {method: 'PATCH', body: JSON.stringify({direction})}
      );
      await refresh();
    } catch (error) {toast(error.message, true);}
  }

  /**
   * Transforms the entries used by ask bulk delete.
      * @return {*} Result of this expression.
*/
  function askBulkDelete() {
    const room = currentRoom();
    const ids = selectedFurniture(room);
    if (!ids.length) return toast(t("warehouse.selection.noFurniture"), true);
    pendingDelete = {ids};
    modal.showModal(
      t("warehouse.bulk.deleteTitle", {count: ids.length}),
      renderTemplate('askBulkDeleteP', {
        deleteConfirmation: t("warehouse.bulk.deleteConfirmation",
          {count: ids.length}),
        ids: ids.map(id => room.furniture
          .find(f => f.id === id)?.name).map(safe).join(', '),
        destructiveFooter: destructiveFooter({
          cancelLabel: t("common.actions.cancel"),
          acceptLabel: t("warehouse.bulk.deleteAction", {count: ids.length}
          ),
          acceptAction: 'warehouse-confirm-delete',
          className: 'warehouse-form-actions',
        }),
      })
    );
  }

  /**
   * Selects and transforms the ask delete records.
   *
   * @param {*} kind Value used by this operation.
   * @param {*} id Identifier of the affected record.
   */
  function askDelete(kind, id) {
    const endpoints = {
      room: `/api/warehouse/rooms/${id}`,
      furniture: `/api/warehouse/furniture/${id}`,
      shelf: `/api/warehouse/shelves/${id}`,
    };
    pendingDelete = endpoints[kind];
    if (kind === 'room') {
      const room = w().rooms.find(entry => entry.id === id);
      if (!room) return;
      const shelfIds = new Set(room.furniture.flatMap(furniture =>
        furniture.shelves.map(shelf => shelf.id)));
      const occupied = Object.values(w().assignments || {})
        .filter(shelfId => shelfIds.has(shelfId)).length;
      if (occupied) {
        modal.showModal(
          t('warehouse.rooms.deleteOccupiedTitle'),
          renderTemplate('askDeleteP', {
            deleteOccupiedMessage: tHtml(
              'warehouse.rooms.deleteOccupiedMessage',
              {name: room.name, count: occupied}
            ),
            destructiveFooter: destructiveFooter({
              cancelLabel: t('common.actions.cancel'),
              acceptLabel: t('warehouse.rooms.unassignAndDelete'),
              acceptAction: 'warehouse-confirm-delete-unassign',
              className: 'warehouse-form-actions',
            }),
          })
        );
        return;
      }
      modal.showModal(
        t('warehouse.rooms.delete'),
        renderTemplate('askDeleteP2', {
          deleteEmptyMessage: tHtml('warehouse.rooms.deleteEmptyMessage',
            {name: room.name}),
          destructiveFooter: destructiveFooter({
            cancelLabel: t('common.actions.cancel'),
            acceptLabel: t('common.actions.remove'),
            acceptAction: 'warehouse-confirm-delete',
            className: 'warehouse-form-actions',
          }),
        })
      );
      return;
    }
    modal.showModal(
      t("warehouse.bottles.removeStorageLocation"),
      renderTemplate('askDeleteP3', {
        destructiveFooter: destructiveFooter({
          cancelLabel: t("common.actions.cancel"),
          acceptLabel: t("common.actions.remove"),
          acceptAction: 'warehouse-confirm-delete',
          className: 'warehouse-form-actions',
        }),
      })
    );
  }

  /**
   * Clears confirmed for warehouse.
   *
   * @param {boolean=} unassignBottles Unassign bottles used by this operation.
   */
  async function deleteConfirmed(unassignBottles = false) {
    if (!pendingDelete) return;
    const target = pendingDelete;
    const bulk = typeof target === 'object';
    const endpoint = unassignBottles && !bulk &&
      target.startsWith('/api/warehouse/rooms/')
      ? `${target}?unassignBottles=true` : target;
    try {
      await request(
        bulk ? '/api/warehouse/furniture/bulk/delete' : endpoint,
        {
          method: bulk ? 'POST' : 'DELETE',
          ...(bulk ? {body: JSON.stringify(target)} : {}),
        }
      );
      pendingDelete = null;
      modal.closeModal(); state.warehouseFurnitureId = null;
      if (bulk) state.warehouseSelectedFurnitureIds = [];
      await refresh(); toast(bulk ?
        t("warehouse.bulk.deletedSuccess", {count: target.ids.length}) :
        t("warehouse.bottles.storageLocationRemoved"));
    } catch (err) {toast(err.message, true);}
  }

  /**
   * Selects room matching the input.
   *
   * @param {*} id Identifier of the affected record.
   * @param {string=} section Value used by this operation.
   */
  function selectRoom(id, section = 'rooms') {
    state
      .warehouseSelectedFurnitureIds = []; state.warehouseRoomId = id;
    state.warehouseFurnitureId = null; navigate('warehouse', section);
  }

  /**
   * Derives the edit furniture from plan result from the supplied values.
   *
   * @param {*} id Identifier of the affected record.
   */
  function editFurnitureFromPlan(id) {
    const found = findFurniture(w(), id);
    if (!found) return;
    state.warehouseRoomId = found.room.id;
    state.warehouseFurnitureId = id;
    navigate('warehouse', 'shelves');
    openForm('furniture', id);
  }

  /**
   * Retrieves furniture for warehouse.
   *
   * @param {string} id Identifier used to select the relevant record.
   */
  function selectFurniture(id) {
    const found = findFurniture(w(), id);
    if (!found) return;
    state.warehouseRoomId = found.room.id;
    state.warehouseFurnitureId = id;
    // Selecting furniture is not a page change: the router otherwise scrolls to
    // the top.
    if (typeof window !== 'undefined' && window.history?.replaceState &&
      ['rooms', 'shelves'].includes(state.selected)) {
      window.history.replaceState(
        {whiskyRoute: true},
        '',
        routeUrl(
          'warehouse',
          state.selected,
          {roomId: found.room.id, furnitureId: id}
        )
      );
    }
    render();
  }
  // Backwards-compatible event entry point; finder input updates without
  // replacing itself.

  /**
   * Selects search matching the input.
   */
  function filterSearch() {
    setFinderQuery(document.getElementById(
      'warehouse-search')?.value || '');
  }

  /**
   * Registers drag for warehouse.
   */
  function attachDrag() {
    const svg = document.querySelector('.warehouse-floor'); if (!svg) return;
    let drag = null;
    const activation = createFurnitureActivation(selectFurniture,
      editFurnitureFromPlan);
    svg.addEventListener('keydown', event => {
      const furniture = event.target.closest?.('.warehouse-drag');
      if (!furniture) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (event.shiftKey) openForm('furniture', furniture.dataset.id);
        else selectFurniture(furniture.dataset.id);
      }
    });
    svg.addEventListener('pointerdown', e => {
      const g = e.target.closest('.warehouse-drag'); if (!g || e.button !==
        0) return;
      const found = findFurniture(w(), g.dataset.id); if (!found) return;
      drag = {
        id: g.dataset.id,
        origX: found.furniture.x,
        origY: found.furniture.y,
        startX: e.clientX,
        startY: e.clientY,
        newX: found.furniture.x,
        newY: found.furniture.y,
        moved: false,
        room: found.room,
      };
      svg.setPointerCapture(e.pointerId); e.preventDefault();
    });
    svg.addEventListener('pointermove', e => {
      if (!drag) return;
      const rect = svg.getBoundingClientRect(); if (rect.width === 0 ||
        rect.height === 0) return;
      const item = findFurniture(w(), drag.id)?.furniture; if (!item) return;
      const dx = (e.clientX - drag.startX) * drag.room.width / rect.width;
      const dy = (e.clientY - drag.startY) * drag.room.height / rect.height;
      if (Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY -
        drag.startY) > 6) drag.moved = true;
      // The preview uses the same 3D collision rules as the server. A fast
      // pointer movement cannot jump through another piece of furniture.
      const position = moveFurnitureTowards(
        drag.room,
        item,
        drag.newX,
        drag.newY,
        drag.origX + dx,
        drag.origY + dy
      );
      const x = position.x, y = position.y;
      drag.newX = x; drag.newY = y;
      const vb = svg.viewBox.baseVal;
      const g = svg.querySelector(`.warehouse-drag[data-id="${drag.id}"]`);
      if (g) {
        const shape = g.querySelector('rect'); if (shape) {
          const tx =
            x * vb.width / drag.room.width, ty = y * vb.height / drag.room
              .height; const oldX = parseFloat(shape.getAttribute('x')) -
                1, oldY = parseFloat(shape.getAttribute('y')) -
                  1; g.setAttribute(
                    'transform',
                    `translate(${tx - oldX} ${ty - oldY})`
                  );
        }
      }
    });
    svg.addEventListener('pointerup', async e => {
      if (!drag) return; const current = drag; drag = null;
      if (!current.moved) {activation.activate(current.id); return;}
      const item = findFurniture(w(), current.id)?.furniture; if (!item) return;
      try {
        await request(
          `/api/warehouse/furniture/${current.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              ...item, x: current.newX ??
                item.x, y: current.newY ?? item.y,
            }),
          }
        ); await refresh();
      }
      catch (err) {toast(err.message, true); render();}
    });
    svg.addEventListener('pointercancel', () => {drag = null; render();});
  }
  return {
    render,
    openShelfDetails,
    openOccupiedShelfDetails,
    /**
     * Performs the open room transfer lifecycle action.
     * @return {*} Result computed from the supplied inputs.
     */
    openRoomTransfer: () => roomTransfer.openTransfer(state.selected ===
      'rooms' ? currentRoom()?.id : undefined),
    update3DZoom,
    toggleFurnitureVisibility,
    showAllFurniture,
    openForm,
    showBottleLocation,
    returnToFinder,
    clearFindFocus,
    setFinderQuery,
    setFinderPlacement,
    stepFinderPage,
    openFurnitureManager,
    openFurnitureBulkManager,
    openBottlePreview,
    submit,
    switchShelf,
    uploadFurniturePhotos,
    moveFurniturePhoto,
    deleteFurniturePhoto,
    openFurniturePhoto,
    moveShelf,
    askDelete,
    deleteConfirmed,
    selectRoom,
    selectFurniture,
    filterSearch,
    toggleFurnitureSelection,
    toggleFurnitureBulkSelection,
    selectAllFurniture,
    clearFurnitureSelection,
    askBulkDelete,
    toggleBottleSelection,
    toggleWallBottleSelection,
    previewSelectedBottle,
    clearBottleSelection,
    selectAllBottles,
    assignSelectedBottles,
    setUnassignedWallSearch,
    stepUnassignedWallPage,
  };
}
