

/**
 * Builds the warehouse actions for delegated application events.
 * @param {!Object} options Dependencies of the event group.
 * @return {!Object} Action handlers keyed by action name.
 */
export function createWarehouseActions({warehouseView, state, navigate, render}) {
  return {
    /**
     * Navigates to the storage subsection supplied by the action.
     * @param {!HTMLElement} button Action element carrying data-section.
     * @return {void} Navigation is synchronous; no result is consumed.
     */
    'warehouse-section': button => navigate('warehouse', button.dataset.section),

    /**
     * Handles the warehouse plan mode interaction.
     *
     * @param {*} button Button control involved in the interaction.
     */
    'warehouse-plan-mode': button => {
      state.warehousePlanMode = ['2d', '3d'].includes(button.dataset.mode) ? button.dataset.mode : '2d'; render();
    },

    /**
     * Handles the warehouse camera interaction.
     *
     * @param {*} button Button control involved in the interaction.
     */
    'warehouse-camera': button => {
      if (['nw', 'ne', 'se', 'sw'].includes(button.dataset.corner)) {
        state.warehousePlanCorner = button.dataset.corner; render();
      }
    },

    /**
     * Toggles visibility of the identified furniture in the current room.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {boolean} Whether the identified furniture is visible after toggling.
     */
    'warehouse-visibility-toggle': button =>
      warehouseView.toggleFurnitureVisibility(button.dataset.id),

    /**
     * Restores all hidden furniture in the current room.
     * @return {number} Number of furniture items made visible.
     */
    'warehouse-show-all': () => warehouseView.showAllFurniture(),

    /**
     * Handles the warehouse find interaction.
     */
    'warehouse-find': () => {
      state.warehouseFinderPlacement = 'unassigned'; state.warehouseFinderPage = 1; navigate('warehouse', 'find');
    },

    /**
     * Focuses the identified physical bottle in its storage location.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-find-location': button =>
      warehouseView.showBottleLocation(button.dataset.id),

    /**
     * Returns from a located bottle to the finder.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-return-find': () => warehouseView.returnToFinder(),

    /**
     * Clears the current storage search focus.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-find-clear': () => warehouseView.clearFindFocus(),

    /**
     * Moves back one page of storage search results.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-find-prev': () => warehouseView.stepFinderPage(-1),

    /**
     * Moves forward one page of storage search results.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-find-next': () => warehouseView.stepFinderPage(1),

    /**
     * Opens the compartment-management section.
     * @return {void} Navigation is synchronous; no result is consumed.
     */
    'warehouse-open-shelves': () => navigate('warehouse', 'shelves'),

    /**
     * Opens a new-room form.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-room-new': () => warehouseView.openForm('room'),

    /**
     * Opens room import and export controls.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-rooms-transfer': () => warehouseView.openRoomTransfer(),

    /**
     * Opens the edit form for the identified room.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-room-edit': button =>
      warehouseView.openForm('room', button.dataset.id),

    /**
     * Opens confirmation for deletion of the identified room.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-room-delete': button =>
      warehouseView.askDelete('room', button.dataset.id),

    /**
     * Selects the identified room and navigates to its management view.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-select-room': button =>
      warehouseView.selectRoom(button.dataset.id),

    /**
     * Opens a new-furniture form.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-furniture-new': () => warehouseView.openForm('furniture'),

    /**
     * Opens the manager for the identified furniture.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-furniture-manage': button =>
      warehouseView.openFurnitureManager(button.dataset.id),

    /**
     * Opens the manager for selected furniture.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-furniture-bulk': () => warehouseView.openFurnitureBulkManager(),

    /**
     * Toggles the identified furniture in the bulk-edit selection.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-toggle-furniture': button =>
      warehouseView.toggleFurnitureBulkSelection(button.dataset.id),

    /**
     * Selects all furniture in the current room for bulk editing.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-bulk-select-all': () => warehouseView.selectAllFurniture(),

    /**
     * Clears the bulk furniture selection.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-bulk-clear': () => warehouseView.clearFurnitureSelection(),

    /**
     * Opens the form for editing selected furniture.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-bulk-edit': () => warehouseView.openForm('furniture-bulk'),

    /**
     * Opens confirmation for deleting selected furniture.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-bulk-delete': () => warehouseView.askBulkDelete(),

    /**
     * Opens the edit form for the identified furniture.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-furniture-edit': button =>
      warehouseView.openForm('furniture', button.dataset.id),

    /**
     * Opens a form initialized from the identified furniture.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-furniture-copy': button =>
      warehouseView.openForm('furniture-copy', button.dataset.id),

    /**
     * Opens confirmation for deleting the identified furniture.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-furniture-delete': button =>
      warehouseView.askDelete('furniture', button.dataset.id),

    /**
     * Selects the identified furniture in the current workspace.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-select-furniture': button =>
      warehouseView.selectFurniture(button.dataset.id),

    /**
     * Opens the compartment form for the identified owner.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-shelf-new': button =>
      warehouseView.openForm('shelf', button.dataset.id),

    /**
     * Opens the compartment details using the shelf ID or fallback action ID.
     * @param {!HTMLElement} button Action element carrying data-shelf-id, data-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-shelf-view': button =>
      warehouseView.openShelfDetails(button.dataset.shelfId || button.dataset.id),

    /**
     * Moves the identified compartment one position upward.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-shelf-up': button => warehouseView.moveShelf(button.dataset.id, 'up'),

    /**
     * Moves the identified compartment one position downward.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-shelf-down': button => warehouseView.moveShelf(button.dataset.id, 'down'),

    /**
     * Opens the edit form for the identified compartment.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-shelf-edit': button =>
      warehouseView.openForm('shelf', button.dataset.id),

    /**
     * Switches to the compartment referenced by the action's target.
     * @param {!HTMLElement} button Action element carrying data-target.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-shelf-switch': button =>
      warehouseView.switchShelf(button.dataset.target),

    /**
     * Moves the identified furniture photo in the requested direction.
     * @param {!HTMLElement} button Action element carrying data-id, data-photo-id, data-direction.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-photo-move': button => warehouseView.moveFurniturePhoto(button.dataset.id, button.dataset.photoId, button.dataset.direction),

    /**
     * Starts removal of the identified furniture photo.
     * @param {!HTMLElement} button Action element carrying data-id, data-photo-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-photo-delete': button => warehouseView.deleteFurniturePhoto(button.dataset.id, button.dataset.photoId),

    /**
     * Opens the furniture photo at the supplied path and title.
     * @param {!HTMLElement} button Action element carrying data-path, data-title.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-photo-open': button => warehouseView.openFurniturePhoto(button.dataset.path, button.dataset.title),

    /**
     * Opens a form initialized from the identified compartment.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-shelf-copy': button =>
      warehouseView.openForm('shelf-copy', button.dataset.id),

    /**
     * Opens confirmation for deleting the identified compartment.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-shelf-delete': button =>
      warehouseView.askDelete('shelf', button.dataset.id),

    /**
     * Opens the relocation form for the identified physical bottle.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-assign': button =>
      warehouseView.openForm('assign', button.dataset.id),

    /**
     * Opens relocation for the selected physical bottles.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-bottles-assign-selected': () =>
      warehouseView.assignSelectedBottles(),

    /**
     * Clears the physical-bottle selection.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-bottles-select-clear': () =>
      warehouseView.clearBottleSelection(),

    /**
     * Selects all eligible physical bottles in the current selection scope.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-bottles-select-all': () => warehouseView.selectAllBottles(),

    /**
     * Opens the read-only preview of the identified physical bottle.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-bottle-preview': button =>
      warehouseView.openBottlePreview(button.dataset.id),

    /**
     * Toggles the physical bottle in the wall selection.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-bottle-select': button =>
      warehouseView.toggleWallBottleSelection(button.dataset.id),

    /**
     * Opens a preview when exactly one physical bottle is selected.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-bottles-preview-selected': () =>
      warehouseView.previewSelectedBottle(),

    /**
     * Moves back one page of the unassigned-bottle tray.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-unassigned-prev': () => warehouseView.stepUnassignedWallPage(-1),

    /**
     * Moves forward one page of the unassigned-bottle tray.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-unassigned-next': () => warehouseView.stepUnassignedWallPage(1),

    /**
     * Handles the warehouse focus interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Whether the requested condition is met.
     */
    'warehouse-focus': button => {
      // A location link belongs to a physical bottle, not just a shelf.
      // Reuse the finder focus so the exact bottle is visible and marked.
      if (button.dataset.bottleId) {
        warehouseView.showBottleLocation(button.dataset.bottleId, {returnToBottlingId: state.selected});
        return;
      }
      // Existing shelf-only links still open the shelf without a bottle focus.
      const place = state.warehouse?.rooms.find(r => r.furniture.some(f => f.shelves.some(s => s.id === button.dataset.id)));
      if (!place) return navigate('warehouse', 'find');
      state.warehouseRoomId = place.id;
      state.warehouseFurnitureId = place.furniture.find(f => f.shelves.some(s => s.id === button.dataset.id)).id;
      navigate('warehouse', 'shelves');
    },

    /**
     * Confirms the pending storage deletion.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-confirm-delete': () => warehouseView.deleteConfirmed(),

    /**
     * Confirms deletion and removal of associated bottle assignments.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'warehouse-confirm-delete-unassign': () =>
      warehouseView.deleteConfirmed(true),
  };
}
