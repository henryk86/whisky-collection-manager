import {createWarehouseInspectionController} from './warehouse-inspection-controller.js';
import {createWarehouseFinderController} from './warehouse-finder-controller.js';
import {createWarehouseMutationController} from './warehouse-mutation-controller.js';
import {createWarehousePhotoController} from './warehouse-photo-controller.js';
import {createWarehouseDeleteController} from './warehouse-delete-controller.js';
import {createWarehouseFormController} from './warehouse-form-controller.js';
import {createWarehouseWorkspaceModel} from './models/warehouse.js';
import {renderWarehouseWorkspace} from './warehouse-workspace.js';
import {createWarehouseFurnitureSelection} from './warehouse-furniture-selection-controller.js';
import {createWarehouseBottleSelection} from './warehouse-bottle-selection-controller.js';
import {attachWarehousePlanDrag} from './warehouse-plan-drag.js';
import {replaceContent} from '../ui/dom-renderer.js';

import {t} from '../i18n/index.js';

import {toast} from '../ui/notifications.js';

import {request} from '../api.js';
import {createWarehouseSceneController} from './warehouse-scene-controller.js';
import {routeUrl} from '../navigation/routes.js';

import {mountWarehouseBottleDrag} from '../ui/warehouse-bottle-drag.js';
import {createWarehouseRoomTransfer} from './warehouse-room-transfer.js';

import {roomOptions, findFurniture} from './warehouse-presentation.js';
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
  let unmountBottleDrag = null;
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
   * Reads the current warehouse state from the application store.
   * @return {*} Result computed from the supplied inputs.
   */
  const w = () => state.warehouse;
  const roomTransfer = createWarehouseRoomTransfer({
    modal, request,
    getWarehouse: w, refresh, toast,
  });
  /**
   * Resolves the selected room, falling back to the first room.
   * @return {*} Result computed from the supplied inputs.
   */
  const currentRoom = () => roomOptions(w(), state.warehouseRoomId) || w().rooms[0];

  const {openFurnitureManager, openFurnitureBulkManager, openShelfDetails, openOccupiedShelfDetails, openBottlePreview} = createWarehouseInspectionController({w, state, currentRoom, modal, attachBottlePhotos});
  const scene = createWarehouseSceneController({state, currentRoom, selectFurniture, openOccupiedShelfDetails});
  const {selectedFurniture, toggleFurnitureSelection, toggleFurnitureBulkSelection, selectAllFurniture, clearFurnitureSelection, toggleFurnitureVisibility, showAllFurniture} = createWarehouseFurnitureSelection({
    state, currentRoom, mountContent, setSceneVisibility: scene.setSceneVisibility,
  });
  const {selectedBottleIds, toggleBottleSelection, toggleWallBottleSelection, previewSelectedBottle, clearBottleSelection, selectAllBottles, assignSelectedBottles, setUnassignedWallSearch, stepUnassignedWallPage, attachUnassignedTray, trayOptions} = createWarehouseBottleSelection({
    state, w, attachBottlePhotos, openBottlePreview,
    /**
     * Opens the bulk assignment form after controller initialization.
     * @return {*} Result of opening the assignment dialog.
     */
    openForm: () => openForm('assign-bulk'),
  });
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
    scene.dispose();
    const data = w();
    if (!data) return shell(renderTemplate('hint2'));
    const section = state.selected || 'overview';
    if (section === 'find') {
      state.warehouseFindReturn = false; state.warehouseFindFocusBottleId = null; state.warehouseFindReturnBottlingId = null; state.warehouseFindReturnFlightId = null;
    }
    const model = createWarehouseWorkspaceModel(data, state, {
      section, room: currentRoom(), selectedBottleIds: selectedBottleIds(), tray: trayOptions(),
      finder: section === 'find' || !['overview', 'rooms', 'shelves'].includes(section) ? finderResults() : null,
    });
    shell(renderWarehouseWorkspace(model));
    if (typeof document !== 'undefined' && typeof document.querySelector === 'function') {
      restoreWallScroll();

    }
    if (section === 'rooms') attachWarehousePlanDrag({w, selectFurniture, editFurnitureFromPlan, openForm, refresh, render});
    if (section === 'rooms' || section === 'shelves') scene.attachFurnitureHover(section === 'rooms');
    if (section === 'shelves') {
      attachUnassignedTray();
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
         * @param {*} bottleId Identifier of the dragged physical bottle; uses the bulk selection when it includes this bottle.
         * @return {*} Whether the requested condition is met.
         */
        getDraggedIds: bottleId => selectedBottleIds().includes(bottleId) ? selectedBottleIds() : [bottleId],
        /**
         * Handles the invalid drop interaction.
         *
         * @param {*} reason Drop rejection reason; a full shelf triggers a notification.
         */
        onInvalidDrop: reason => {
          if (reason === 'full') toast(t('warehouse.shelves.dragFull'), true);
        },
      });
    }
    scene.mount(section, data);
    if (section === 'shelves') scrollToFoundBottle();
  }

  const openForm = createWarehouseFormController({w, currentRoom, selectedFurniture, selectedBottleIds, modal});

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
   * @param {string=} section Warehouse section to navigate to after selecting the room.
   */
  function selectRoom(id, section = 'rooms') {
    state.warehouseSelectedFurnitureIds = []; state.warehouseRoomId = id;
    state.warehouseFurnitureId = null; navigate('warehouse', section);
  }

  /**
   * Navigates to the selected furniture and opens its editing dialog from the room plan.
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

  return {
    render,
    openShelfDetails,
    openOccupiedShelfDetails,
    /**
     * Performs the open room transfer lifecycle action.
     * @return {*} Result computed from the supplied inputs.
     */
    openRoomTransfer: () => roomTransfer.openTransfer(state.selected === 'rooms' ? currentRoom()?.id : undefined),
    update3DZoom: scene.update3DZoom,
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
