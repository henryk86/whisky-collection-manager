import {t} from '../i18n/index.js';
import {WAREHOUSE_CAMERAS} from '../domain/warehouse-3d-model.js';
import {mountWarehouseThree} from '../ui/warehouse-three-scene.js';
import {mountWarehouseRoomPreviews} from '../ui/warehouse-room-previews.js';

/**
 * Owns the mounted room previews and WebGL scene, including stale mounts.
 * @param {!Object} options Navigation callbacks and scene preferences.
 * @return {!Object} Scene lifecycle and interaction methods.
 */
export function createWarehouseSceneController({state, currentRoom, selectFurniture, openOccupiedShelfDetails}) {
  let threeHandle = null;
  let roomPreviews = null;
  let threeTicket = 0;

  /** Disposes the previous scene and invalidates pending asynchronous mounts. */
  function dispose() {
    threeTicket++;
    threeHandle?.dispose();
    threeHandle = null;
    roomPreviews?.dispose();
    roomPreviews = null;
  }

  /**
   * Applies a visibility change to the mounted scene.
   * @param {string} id Furniture identifier.
   * @param {boolean} visible Desired visibility.
   */
  function setSceneVisibility(id, visible) {threeHandle?.setFurnitureVisible?.(id, visible);}

  /**
   * Mounts the visual scene for the selected warehouse section.
   * @param {string} section Active warehouse section.
   * @param {!Object} data Warehouse inventory.
   */
  function mount(section, data) {
    const currentTicket = threeTicket;
    if (section === 'overview') roomPreviews = mountWarehouseRoomPreviews({rooms: data.rooms, warehouse: data});
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
            if (hovered) handle?.setHighlightedFurniture?.(/** @type {HTMLElement} */(hovered.querySelector('.warehouse-bulk-open'))?.dataset.id);
          }
          else handle?.dispose?.();
        })
        .catch(error => {
          console.error('Three.js-Lageransicht konnte nicht gestartet werden:', error);
          if (threeTicket === currentTicket && threeViewport.isConnected) threeViewport.textContent = t('warehouse.view.threeUnavailable');
        });
    }
  }

  /**
   * Registers furniture hover for warehouse.
   *
   * @param {*} withPlan Whether the room plan is mounted and can reflect hover state.
   */
  function attachFurnitureHover(withPlan) {
    // The list is re-created on render; keep hover handlers local to its
    // lifetime.
    // Only the pointer/focus visual state changes: no selection, navigation or
    // WebGL rebuild.
    const list = document.querySelector('.warehouse-bulk-list');
    if (!list?.querySelectorAll) return;
    /**
     * Highlights the same furniture in the 3D scene and the 2D plan.
     *
     * @param {*} id Identifier of the affected record.
     */
    function highlight(id) {
      if (withPlan) {
        threeHandle?.setHighlightedFurniture?.(id);
        document.querySelectorAll('.warehouse-drag').forEach((/** @type {SVGGElement} */ node) => {
          node.classList.toggle('warehouse-hovered', node.dataset.id === id);
        });
      }
    }
    for (const tile of list.querySelectorAll('.warehouse-bulk-item')) {
      const id = /** @type {HTMLElement} */ (tile.querySelector('.warehouse-bulk-open'))?.dataset.id;
      if (!id) continue;
      tile.addEventListener('pointerenter', () => highlight(id));
      tile.addEventListener('pointerleave', () => highlight(null));
      tile.addEventListener('focusin', () => highlight(id));
      tile.addEventListener('focusout', (/** @type {MouseEvent} */ event) => {
        if (!tile.contains(/** @type {Node} */(event.relatedTarget))) highlight(null);
      });
    }
  }

  /**
   * Applies the requested zoom to the mounted WebGL scene, if available.
   *
   * @param {*} value Value to process.
   * @return {*} True if the mounted scene accepted the requested zoom.
   */
  function update3DZoom(value) {return threeHandle?.setZoom(value) ?? false;}

  return {dispose, mount, attachFurnitureHover, setSceneVisibility, update3DZoom};
}
