import {createWarehouseFinderController} from './warehouse-finder-controller.js';
import {createWarehouseMutationController} from './warehouse-mutation-controller.js';
import {createWarehousePhotoController} from './warehouse-photo-controller.js';
import {createWarehouseDeleteController} from './warehouse-delete-controller.js';
import {createWarehouseFormController} from './warehouse-form-controller.js';
import {createWarehouseViewModel, createWarehouseRoomViewModel} from './models/warehouse.js';
import {composeMarkup} from '../ui/render-plan.js';
import {replaceContent, materialize} from '../ui/dom-renderer.js';
import {headerActions, headingTitle, pageHeader} from '../ui/headers.js';

import {t} from '../i18n/index.js';

import {toast} from '../ui/notifications.js';

import {request} from '../api.js';
import {sectionWorkspace} from '../ui/section-navigation.js';
import {WAREHOUSE_CAMERAS} from '../domain/warehouse-3d-model.js';
import {mountWarehouseThree} from '../ui/warehouse-three-scene.js';
import {mountWarehouseRoomPreviews} from '../ui/warehouse-room-previews.js';
import {moveFurnitureTowards} from '../../../shared/warehouse-placement.js';
import {routeUrl} from '../navigation/routes.js';
import {createFurnitureActivation}
  from '../ui/warehouse-furniture-activation.js';
import {eyeIcon, eyeOffIcon, addActionLabel} from '../ui/action-icons.js';

import {mountWarehouseBottleDrag} from '../ui/warehouse-bottle-drag.js';
import {renderWarehouseRoomWall} from './warehouse-room-wall.js';
import {createWarehouseRoomTransfer} from './warehouse-room-transfer.js';
import {shelfContents} from './warehouse-shelf-details.js';
import {renderUnassignedTrayPage} from './warehouse-unassigned-tray.js';
import {unassignedWallPage} from '../domain/warehouse-unassigned-tray.js';

import {renderWarehouseFinder} from './warehouse-finder.js';
import {CAMERA_KEYS, ROOM_SECTION_KEYS, typeName, num, capacityLabel, safe, count, bottleLabel, bottlePreview, roomOptions, storagePath, findFurniture, roomDiagram, shelfPanel} from './warehouse-presentation.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates('warehouse/warehouse.html');

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
      if (img.naturalWidth > 0) img.parentElement?.classList.add('has-photo');
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
export function createWarehouseView({state, shell, navigate, modal, refresh, mountContent = replaceContent}) {
  let threeHandle = null;
  let roomPreviews = null;
  let unmountBottleDrag = null;
  let threeTicket = 0;
  let unassignedWallQuery = '';
  let unassignedWallPageNumber = 1;
  let unassignedWallExpanded = false;
  // The page is rebuilt after each successful relocation; remember the
  // *horizontal* wall viewport independently from the document scroll.
  const wallScrollByRoom = new Map();

  /**
   * Derives the remember wall scroll numeric value from its input.
   */
  function rememberWallScroll() {
    const viewport = typeof document === 'undefined' ? null : document.querySelector?.('.warehouse-wall-scroll');
    if (viewport?.dataset?.roomId && Number.isFinite(viewport.scrollLeft)) {
      wallScrollByRoom.set(viewport.dataset.roomId, viewport.scrollLeft);
    }
  }

  /**
   * Updates element attributes used by restore wall scroll.
   */
  function restoreWallScroll() {
    const viewport = typeof document === 'undefined' ? null : document.querySelector?.('.warehouse-wall-scroll');
    if (!viewport?.dataset?.roomId) return;
    const offset = wallScrollByRoom.get(viewport.dataset.roomId);
    if (offset === undefined) return;
    viewport.scrollLeft = offset;
    // After an asynchronous refresh, layout may settle in the next frame.
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => {
      if (viewport.isConnected && viewport.dataset.roomId === currentRoom()?.id) viewport.scrollLeft = offset;
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
  const currentRoom = () => roomOptions(w(), state.warehouseRoomId) || w().rooms[0];

  /**
   * Derives the current furniture result from the supplied values.
   *
   * @param {*} room Warehouse room being inspected or modified.
   * @return {*} Result computed from the supplied inputs.
   */
  const currentFurniture = room => room?.furniture.find(f => f.id === state.warehouseFurnitureId);

  /**
   * Filters records according to the selected furniture selection rules.
   *
   * @param {*} room Warehouse room being inspected or modified.
   * @return {*} Entries that meet the selection criteria.
   */
  const selectedFurniture = room => (state.warehouseSelectedFurnitureIds || []).filter(id => room?.furniture.some(f => f.id === id));

  /**
   * Filters records according to the selected bottle ids selection rules.
   * @return {*} Entries that meet the selection criteria.
   */
  const selectedBottleIds = () => (state.warehouseSelectedBottleIds || []).filter(id => w()?.bottles?.some(b => b.id === id));

  /**
   * Builds the localized bottle selection tools text for the current language.
   *
   * @param {boolean=} withAll Value used by this operation.
   * @return {string} Resulting text.
   */
  const bottleSelectionTools = (withAll = false) => {
    const total = selectedBottleIds().length;
    return renderTemplate('warehouseBottleBulkTools', {
      ariaLabel: safe(t('warehouse.bottles.bulkTools')),
      bulkSelected: safe(t('warehouse.bottles.bulkSelected', {count: total})),
      warehouseBottlesSelectAll: withAll ? renderTemplate('warehouseBottlesSelectAll') : '',
      disabledAttributes: total ? {} : {"disabled": true},
      assignDisabled: total ? {} : {"disabled": true},
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
   * @param {*} delta Value used by this operation.
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
      compact: compact ? ' warehouse-bulk-panel--sidebar' : '',
      layoutOnly: layoutOnly ? t("warehouse.furniture.plural") : t("warehouse.selection.instructions"),
      span: layoutOnly ?
        renderTemplate('selectionPanelSpan', {length: room.furniture.length, }) :
        renderTemplate('warehouseBulkCount', {
          count: t("warehouse.selection.count", {selected: selected.size, total: room.furniture.length}),
        }),
      warehouseShowAll: isolate ?
        renderTemplate('warehouseShowAll', {
          disabledAttributes: room.furniture.some(item => hiddenIds.has(item.id)) ? {} : {"disabled": true},
        }) :
        '',
      furniture: composeMarkup(room.furniture.map(furniture => {
        const occupied = furniture.shelves.reduce((n, shelf) => n + count(w(), shelf.id), 0);
        const visible = !hiddenIds.has(furniture.id);
        const actionLabel = t(
          "warehouse.visibility.accessibleLabel",
          {
            name: furniture.name,
            action: t(visible ? "warehouse.visibility.hide" : "warehouse.visibility.show"),
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
            id: safe(furniture.id),
            name: name,
            ariaCurrentAttributes: state.warehouseFurnitureId === furniture.id ? {"aria-current": "true"} : {},
            furnitureName: name,
            summary: summary,
          })
          : renderTemplate('warehouseToggleFurniture', {
            id: safe(furniture.id),
            has: selected.has(furniture.id),
            ariaLabel: safe(t('warehouse.furniture.selectForBulkEdit', {name: furniture.name})),
            name: name,
            summary: summary,
          });
        return renderTemplate('warehouseBulkItem', {
          content: !layoutOnly && selected.has(furniture.id) ? ' is-selected' : '',
          warehouseFurnitureId: state.warehouseFurnitureId === furniture.id && layoutOnly ? ' is-current' : '',
          isolate: isolate && !visible ? ' is-hidden' : '',
          furnitureControl: furnitureControl,
          warehouseVisibilityToggle: isolate ?
            renderTemplate('warehouseVisibilityToggle', {
              id: safe(furniture.id),
              visible: visible,
              title: safe(actionLabel),
              ariaLabel: safe(actionLabel),
              visibilityIcon: visible ? eyeIcon : eyeOffIcon,
            }) : '',
        });
      })),
      selectionControls: layoutOnly ? '' :
        renderTemplate('warehouseBulkSelectAll', {
          disabledAttributes: selected.size ? {} : {"disabled": true},
          clearDisabled: selected.size ? {} : {"disabled": true},
          deleteAction: t("warehouse.bulk.deleteAction", {count: selected.size}),
          manageDisabled: selected.size ? {} : {"disabled": true},
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
    for (const button of document.querySelectorAll('.warehouse-bulk-visibility')) {
      if (button.dataset.id !== furniture.id) continue;
      const label = t(
        "warehouse.visibility.accessibleLabel",
        {
          name: furniture.name,
          action: t(visible ? "warehouse.visibility.hide" : "warehouse.visibility.show"),
        }
      );
      button.setAttribute('aria-pressed', String(visible));
      button.setAttribute('aria-label', label);
      button.title = label;
      mountContent(button, visible ? eyeIcon : eyeOffIcon);
      button.closest('.warehouse-bulk-item')?.classList.toggle('is-hidden', !visible);
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
    if (button) button.disabled = !room.furniture.some(item => (state.warehouseHiddenFurnitureIds || []).includes(item.id));
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
    if (label) label.textContent = t("warehouse.selection.count", {selected: count, total: room?.furniture.length ?? 0});
    const edit = document.querySelector('.warehouse-bulk-edit-btn');
    if (edit) {
      edit.disabled = count === 0; edit.textContent = t("warehouse.bulk.editAction", {count});
    }
    const remove = document.querySelector('.warehouse-bulk-delete-btn');
    if (remove) {
      remove.disabled = count === 0; remove.textContent = t("warehouse.bulk.deleteAction", {count});
    }
    const clear = document.querySelector('.warehouse-bulk-clear-btn');
    if (clear) clear.disabled = count === 0;
    const selected = new Set(selectedFurniture(room));
    document.querySelectorAll('.warehouse-bulk-pick').forEach(button => {
      const pressed = selected.has(button.dataset.id);
      button.setAttribute('aria-pressed', String(pressed));
      button.closest('.warehouse-bulk-item')?.classList.toggle('is-selected', pressed);
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
    toggleFurnitureSelection(id, !selectedFurniture(currentRoom()).includes(id));
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

  const {refreshFurnitureModal, uploadFurniturePhotos, moveFurniturePhoto, openFurniturePhoto, deleteFurniturePhoto} = createWarehousePhotoController({w, modal, refresh, attachBottlePhotos});
  const {askBulkDelete, askDelete, deleteConfirmed} = createWarehouseDeleteController({currentRoom, selectedFurniture, modal, w, state, refresh});
  const {finderResults, setFinderQuery, setFinderPlacement, stepFinderPage, showBottleLocation, clearFindFocus, returnToFinder, scrollToFoundBottle} = createWarehouseFinderController({w, state, mountContent, navigate, rememberWallScroll});
  const {submit, relocateBottle, moveShelf} = createWarehouseMutationController({w, modal, selectedFurniture, currentRoom, refresh, selectedBottleIds, state, refreshFurnitureModal, rememberWallScroll, render});

  /**
   * Renders the selected warehouse workspace.
   * @return {*} Shell result when no warehouse exists, otherwise undefined.
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
      state.warehouseFindReturn = false; state.warehouseFindFocusBottleId = null; state.warehouseFindReturnBottlingId = null; state.warehouseFindReturnFlightId = null;
    }
    const {total, assigned, overallCapacity, roomCount, furnitureCount} = createWarehouseViewModel(data);
    const roomModel = createWarehouseRoomViewModel(data, state);
    let content = '';
    if (section === 'overview') {
      content =
        renderTemplate('stats', {
          length: roomCount,
          reduce: furnitureCount,
          assigned: assigned,
          total: total,
          unlimited: overallCapacity.unlimited ? ` ${t('warehouse.capacity.unlimitedExtra', {count: overallCapacity.unlimited})}` : '',
          shelves: overallCapacity.shelves === 0 ? '–' :
            overallCapacity.unlimited && overallCapacity.defined === 0 ?
              t('warehouse.capacity.open') :
              `${overallCapacity.defined}${overallCapacity.unlimited ? '+' : ''}`,
          headingTitle: headingTitle({title: t('warehouse.rooms.yourRooms'), }),
          rooms: composeMarkup(roomModel.rooms.map(({room, capacity: cap}) => {
            return renderTemplate('warehouseSelectRoom', {
              id: safe(room.id),
              previewRoomId: safe(room.id),
              name: safe(room.name),
              furnitureAndDimensions: t(
                "warehouse.rooms.furnitureAndDimensions",
                {
                  count: room.furniture.length,
                  width: num(room.width),
                  depth: num(room.height),
                }
              ),
              summary: t("warehouse.capacity.summary", {capacity: capacityLabel(cap)}),
              count: t("warehouse.occupancy.count", {count: cap.occupied}),
            });
          })) ||
            renderTemplate('hint3'),
          addActionLabel: addActionLabel(t("warehouse.rooms.createWithPlus")),
          unassignedCount: t("warehouse.bottles.unassignedCount", {count: total - assigned}),
        });
    } else if (section === 'rooms' || section === 'shelves') {
      const room = currentRoom();
      const roomManagementActions = section === 'rooms'
        ? renderTemplate('warehouseRoomNew', {
          addActionLabel: addActionLabel(t("warehouse.rooms.addWithPlus")),
          warehouseRoomEdit: room ? renderTemplate('warehouseRoomEdit', {
            id: safe(room.id),
            deleteRoomId: safe(room.id),
          }) : '',
        })
        : '';
      content = renderTemplate('warehouseRoomToolbar', {
        rooms: composeMarkup(data.rooms.map(r => renderTemplate('renderOption', {
          value: safe(r.id),
          selectedAttributes: r.id === room?.id ? {"selected": true} : {},
          name: safe(r.name),
        }))),
        roomManagementActions: roomManagementActions,
      });
      if (room) {
        const furniture = currentFurniture(room);
        const cap = roomModel.rooms.find(item => item.room.id === room.id).capacity;
        const roomSummary =
          renderTemplate('warehouseRoomSummary', {
            name: safe(room.name),
            gridDimensions: t("warehouse.rooms.gridDimensions", {width: num(room.width), height: num(room.height)}),
            capacityLabel: capacityLabel(cap),
            occupied: cap.occupied,
            bottleUnit: cap.occupied === 1 ? t("forms.bottle.title") : t("forms.bottle.plural"),
          });
        const {level, planMode, planCorner, zoom} = roomModel;
        const viewSwitch =
          renderTemplate('warehouseViewSwitch', {
            planMode: planMode === '2d' ? ' primary' : '',
            ariaPressed: planMode === '2d',
            threeDimensionalClass: planMode === '3d' ? ' primary' : '',
            threeDimensionalPressed: planMode === '3d',
          });
        const planFilter = planMode === '2d' ?
          renderTemplate('warehousePlanFilter', {
            allAttributes: level === 'all' ? {"selected": true} : {},
            floorAttributes: level === 'floor' ? {"selected": true} : {},
            elevatedAttributes: level === 'elevated' ? {"selected": true} : {},
          }) : renderTemplate('warehousePlanFilter2', {
            content: composeMarkup([100, 150, 200].map(z => renderTemplate(
              'planFilterOption',
              {
                z: z,
                selectedAttributes: z === zoom ? {"selected": true} : {},
                zoomLabel: z,
              }
            ))),
          });
        const cornerButtons = planMode === '3d' ?
          renderTemplate('warehouseCameraToolbar', {
            cameraButtons: composeMarkup(WAREHOUSE_CAMERAS.map(([id,
              label]) => renderTemplate('smallButton', {
                planCorner: planCorner === id ? ' primary' : '',
                id: id,
                ariaPressed: planCorner === id,
                t: t(CAMERA_KEYS[id]),
              }))),
          }) : '';
        const planToolbar =
          renderTemplate('warehousePlanTools', {
            viewSwitch: viewSwitch,
            cornerButtons: cornerButtons,
            planFilter: planFilter,
            warehouseFurnitureNew: section === 'rooms' ?
              renderTemplate('warehouseFurnitureNew', {addActionLabel: addActionLabel(t('warehouse.furniture.place')), }) : '',
          });
        const plan = planMode === '3d' ?
          renderTemplate('warehouseThreeViewport') : roomDiagram(room, {...data, focusFurnitureId: furniture?.id}, level);
        if (section === 'rooms') {
          // Room plans own spatial layout only: 2D/3D positioning,
          // camera and visibility. All furniture/shelf editing and
          // physical bottle work lives in Regale & Fächer.
          content = composeMarkup(content,
            roomSummary,
            planToolbar,
            (planMode === '3d'
              ? renderTemplate('warehousePlanWorkspace', {
                plan: plan,
                selectionPanel: selectionPanel(room, {isolate: true, compact: true, layoutOnly: true}),
              })
              : composeMarkup(plan, selectionPanel(room, {layoutOnly: true}))),
            renderTemplate(
              'warehouseSectionBoundary',
              {
                furniture: furniture ? ' warehouse-plan-focus' : '',
                warehousePlanFocusInfo: furniture
                  ? renderTemplate('warehousePlanFocusInfo', {
                    name: safe(furniture.name),
                    furnitureType: safe(typeName(furniture.type)),
                    num: num(furniture.x),
                    positionY: num(furniture.y),
                    bottomElevation: num(furniture.elevation ?? 0),
                  })
                  : '',
                warehouseFurnitureManage: furniture ? renderTemplate('warehouseFurnitureManage', {id: safe(furniture.id), }) : '',
              }
            )
          );
        } else {
          const createButton =
            renderTemplate('warehouseFurnitureNew2', {
              id: safe(room.id),
              addActionLabel: addActionLabel(t('warehouse.furniture.place')),
            });
          const manageButton = renderTemplate('warehouseFurnitureBulk');
          const focusBottle = state.warehouseFindReturn ? data.bottles.find(b => b.id === state.warehouseFindFocusBottleId) : null;
          const focusPlace = focusBottle ? storagePath(data, data.assignments[focusBottle.id]) : null;
          const inRoom = focusPlace?.room.id === room.id;
          const findReturn = state.warehouseFindReturn
            ? renderTemplate('warehouseReturnFind', {
              t: t(state.warehouseFindReturnFlightId ?
                'flightPlan.backToFlight' : state.warehouseFindReturnBottlingId ? 'warehouse.find.backToBottling' : 'warehouse.find.backToResults'),
              warehouseFindReturnLabel: inRoom ?
                renderTemplate('warehouseFindReturnLabel', {
                  highlighted: safe(t('warehouse.find.highlighted', {name: bottleLabel(focusBottle), location: focusPlace.label})),
                }) :
                '',
              title: safe(t('warehouse.find.clearHighlight')),
              ariaLabel: safe(t('warehouse.find.clearHighlight')),
            }) : '';
          // The physical wall intentionally omits furniture without shelves.
          // Provide
          // a direct first-shelf action so a newly placed unit is not stranded.
          const withoutShelves = room.furniture.filter(item => item.shelves.length === 0);
          const firstShelfActions = withoutShelves.length
            ? renderTemplate('warehouseUnconfiguredFurniture', {
              withoutShelves: composeMarkup(withoutShelves.map(item =>
                renderTemplate(
                  'warehouseUnconfiguredItem',
                  {
                    name: safe(item.name),
                    id: safe(item.id),
                    addActionLabel: addActionLabel(t('warehouse.shelves.addWithPlus')),
                  }
                ))),
            })
            : '';
          content = composeMarkup(content,
            roomSummary,
            findReturn,
            renderTemplate(
              'warehouseShelvesToolbar',
              {
                headingTitle: headingTitle({title: t('warehouse.navigation.shelves'), }),
                headerActions: headerActions(composeMarkup(manageButton, createButton)),
              }
            ),
            firstShelfActions,
            renderWarehouseRoomWall(
              room,
              data,
              selectedBottleIds(),
              {
                query: unassignedWallQuery,
                page: unassignedWallPageNumber,
                expanded: unassignedWallExpanded,
                focusBottleId: inRoom ? focusBottle.id : null,
              }
            )
          );
        }
      } else content = composeMarkup(content, renderTemplate('hint4'));
    } else {
      content = renderWarehouseFinder({
        query: state.warehouseSearch || '',
        placement: state.warehouseFinderPlacement || 'all',
        results: finderResults(),
      });
    }
    const warehouseTabs = ['overview', 'rooms', 'shelves', 'find'].map(id => [id, t(ROOM_SECTION_KEYS[id])]);
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
      composeMarkup(headingTitle({
        title: t(ROOM_SECTION_KEYS[section] || ROOM_SECTION_KEYS.overview),
        level: 2,
        className: 'analytics-section-title',
      }), content)
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
    if (typeof document !== 'undefined' && typeof document.querySelector === 'function') {
      restoreWallScroll();

    }
    if (section === 'overview') roomPreviews = mountWarehouseRoomPreviews({rooms: data.rooms, warehouse: data});
    if (section === 'rooms') attachDrag();
    if (section === 'rooms' || section === 'shelves') attachFurnitureHover(section === 'rooms');
    if (section === 'shelves') {
      document.querySelector('.warehouse-unassigned-toggle')?.addEventListener(
        'click',
        event => {
          unassignedWallExpanded = !unassignedWallExpanded;
          event.currentTarget.setAttribute('aria-expanded', String(unassignedWallExpanded));
          const tray = document.querySelector('.warehouse-unassigned-tray--embedded');
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
        getDraggedIds: bottleId => selectedBottleIds().includes(bottleId) ? selectedBottleIds() : [bottleId],
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
    const threeViewport = typeof document === 'undefined' ? null : document.querySelector('.warehouse-three-viewport');
    if (threeViewport && section === 'rooms') {
      const room = currentRoom();
      const corner = WAREHOUSE_CAMERAS.some(([id]) => id === state.warehousePlanCorner) ? state.warehousePlanCorner : 'nw';
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
            threeHandle = handle; handle?.setZoom?.(state.warehousePlanZoom || 100);
            for (const furniture of room.furniture) {
              const nowHidden = (state.warehouseHiddenFurnitureIds || []).includes(furniture.id);
              if (initialHidden.has(furniture.id) !== nowHidden) handle?.setFurnitureVisible?.(furniture.id, !nowHidden);
            }
            const hovered = document.querySelector('.warehouse-bulk-item:hover');
            if (hovered) handle?.setHighlightedFurniture?.(hovered.querySelector('.warehouse-bulk-open')?.dataset.id);
          }
          else handle?.dispose?.();
        })
        .catch(error => {
          console.error('Three.js-Lageransicht konnte nicht gestartet werden:', error);
          if (threeTicket === currentTicket && threeViewport.isConnected) threeViewport.textContent = t('warehouse.view.threeUnavailable');
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

  const openForm = createWarehouseFormController({w, currentRoom, selectedFurniture, selectedBottleIds, modal});

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
        furnitureId: safe(found.furniture.id),
        shelfPanel: shelfPanel(data, found.room, found.furniture, {managementOnly: true}),
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
      renderTemplate('warehouseFurnitureBulkManager', {selectionPanel: selectionPanel(room), }),
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
    const bottling = state.collection?.bottlings.find(entry => entry.id === bottle.bottlingId);
    const physicalBottle = bottling?.bottles.find(entry => entry.id === bottle.id);
    modal.showModal(t('warehouse.bottles.detailsTitle'), bottlePreview(w(), bottle, bottling, physicalBottle));
  }

  /**
   * Locates the DOM elements used by switch shelf.
   *
   * @param {*} id Identifier of the affected record.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function switchShelf(id) {
    if (!id) return;
    const form = document.querySelector('#warehouse-form[data-endpoint^="/api/warehouse/shelves/"]');
    if (!form) return;
    const modified = JSON.stringify([...new FormData(form).entries()]) !== form.dataset.initialValues;
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
   * Selects room matching the input.
   *
   * @param {*} id Identifier of the affected record.
   * @param {string=} section Value used by this operation.
   */
  function selectRoom(id, section = 'rooms') {
    state.warehouseSelectedFurnitureIds = []; state.warehouseRoomId = id;
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
    if (typeof window !== 'undefined' && window.history?.replaceState && ['rooms', 'shelves'].includes(state.selected)) {
      window.history.replaceState(
        {whiskyRoute: true},
        '',
        routeUrl('warehouse', state.selected, {roomId: found.room.id, furnitureId: id})
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
    setFinderQuery(document.getElementById('warehouse-search')?.value || '');
  }

  /**
   * Registers drag for warehouse.
   */
  function attachDrag() {
    const svg = document.querySelector('.warehouse-floor'); if (!svg) return;
    let drag = null;
    const activation = createFurnitureActivation(selectFurniture, editFurnitureFromPlan);
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
      const g = e.target.closest('.warehouse-drag'); if (!g || e.button !== 0) return;
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
      const rect = svg.getBoundingClientRect(); if (rect.width === 0 || rect.height === 0) return;
      const item = findFurniture(w(), drag.id)?.furniture; if (!item) return;
      const dx = (e.clientX - drag.startX) * drag.room.width / rect.width;
      const dy = (e.clientY - drag.startY) * drag.room.height / rect.height;
      if (Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY) > 6) drag.moved = true;
      // The preview uses the same 3D collision rules as the server. A fast
      // pointer movement cannot jump through another piece of furniture.
      const position = moveFurnitureTowards(drag.room, item, drag.newX, drag.newY, drag.origX + dx, drag.origY + dy);
      const x = position.x, y = position.y;
      drag.newX = x; drag.newY = y;
      const vb = svg.viewBox.baseVal;
      const g = svg.querySelector(`.warehouse-drag[data-id="${drag.id}"]`);
      if (g) {
        const shape = g.querySelector('rect'); if (shape) {
          const tx = x * vb.width / drag.room.width, ty = y * vb.height / drag.room.height; const oldX = parseFloat(shape.getAttribute('x')) - 1, oldY = parseFloat(shape.getAttribute('y')) - 1; g.setAttribute('transform', `translate(${tx - oldX} ${ty - oldY})`);
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
              ...item, x: current.newX ?? item.x, y: current.newY ?? item.y,
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
    openRoomTransfer: () => roomTransfer.openTransfer(state.selected === 'rooms' ? currentRoom()?.id : undefined),
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
