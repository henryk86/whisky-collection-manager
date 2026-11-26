import {t} from '../i18n/index.js';
import {eyeIcon, eyeOffIcon} from '../ui/action-icons.js';

/**
 * Owns furniture selection, visibility and their mounted controls.
 * @param {!Object} options Warehouse state and scene update callbacks.
 * @return {!Object} Selection and visibility operations.
 */
export function createWarehouseFurnitureSelection({state, currentRoom, mountContent, setSceneVisibility}) {
  /**
   * Filters records according to the selected furniture selection rules.
   *
   * @param {*} room Warehouse room being inspected or modified.
   * @return {*} Entries that meet the selection criteria.
   */
  const selectedFurniture = room => (state.warehouseSelectedFurnitureIds || []).filter(id => room?.furniture.some(f => f.id === id));

  /**
   * Updates furniture visibility in the current state.
   *
   * @param {*} furniture Warehouse furniture record being modified.
   * @param {boolean} visible Whether the selected furniture is visible in the room views.
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
    setSceneVisibility(furniture.id, visible);
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
   * Switches the visibility of the specified furniture and updates the room presentation.
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
   * Updates the bulk furniture selection and synchronizes the selection panel.
   *
   * @param {*} id Identifier of the affected record.
   * @param {boolean} checked Whether the furniture should be included in the selection.
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

  return {selectedFurniture, toggleFurnitureSelection, toggleFurnitureBulkSelection, selectAllFurniture, clearFurnitureSelection, toggleFurnitureVisibility, showAllFurniture};
}
