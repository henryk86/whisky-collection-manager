

/**
 * Builds the warehouse actions for delegated application events.
 * @param {!Object} options Dependencies of the event group.
 * @return {!Object} Action handlers keyed by action name.
 */
export function createWarehouseActions({warehouseView, state, navigate, render}) {
  return {
    /**
     * Handles the warehouse section interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
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
     * Handles the warehouse visibility toggle interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-visibility-toggle': button =>
      warehouseView.toggleFurnitureVisibility(button.dataset.id),

    /**
     * Handles the warehouse show all interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-show-all': () => warehouseView.showAllFurniture(),

    /**
     * Handles the warehouse find interaction.
     */
    'warehouse-find': () => {
      state.warehouseFinderPlacement = 'unassigned'; state.warehouseFinderPage = 1; navigate('warehouse', 'find');
    },

    /**
     * Handles the warehouse find location interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-find-location': button =>
      warehouseView.showBottleLocation(button.dataset.id),

    /**
     * Handles the warehouse return find interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-return-find': () => warehouseView.returnToFinder(),

    /**
     * Handles the warehouse find clear interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-find-clear': () => warehouseView.clearFindFocus(),

    /**
     * Handles the warehouse find prev interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-find-prev': () => warehouseView.stepFinderPage(-1),

    /**
     * Handles the warehouse find next interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-find-next': () => warehouseView.stepFinderPage(1),

    /**
     * Handles the warehouse open shelves interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-open-shelves': () => navigate('warehouse', 'shelves'),

    /**
     * Handles the warehouse room new interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-room-new': () => warehouseView.openForm('room'),

    /**
     * Handles the warehouse rooms transfer interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-rooms-transfer': () => warehouseView.openRoomTransfer(),

    /**
     * Handles the warehouse room edit interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-room-edit': button =>
      warehouseView.openForm('room', button.dataset.id),

    /**
     * Handles the warehouse room delete interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-room-delete': button =>
      warehouseView.askDelete('room', button.dataset.id),

    /**
     * Handles the warehouse select room interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-select-room': button =>
      warehouseView.selectRoom(button.dataset.id),

    /**
     * Handles the warehouse furniture new interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-furniture-new': () => warehouseView.openForm('furniture'),

    /**
     * Handles the warehouse furniture manage interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-furniture-manage': button =>
      warehouseView.openFurnitureManager(button.dataset.id),

    /**
     * Handles the warehouse furniture bulk interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-furniture-bulk': () => warehouseView.openFurnitureBulkManager(),

    /**
     * Handles the warehouse toggle furniture interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-toggle-furniture': button =>
      warehouseView.toggleFurnitureBulkSelection(button.dataset.id),

    /**
     * Handles the warehouse bulk select all interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-bulk-select-all': () => warehouseView.selectAllFurniture(),

    /**
     * Handles the warehouse bulk clear interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-bulk-clear': () => warehouseView.clearFurnitureSelection(),

    /**
     * Handles the warehouse bulk edit interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-bulk-edit': () => warehouseView.openForm('furniture-bulk'),

    /**
     * Handles the warehouse bulk delete interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-bulk-delete': () => warehouseView.askBulkDelete(),

    /**
     * Handles the warehouse furniture edit interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-furniture-edit': button =>
      warehouseView.openForm('furniture', button.dataset.id),

    /**
     * Handles the warehouse furniture copy interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-furniture-copy': button =>
      warehouseView.openForm('furniture-copy', button.dataset.id),

    /**
     * Handles the warehouse furniture delete interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-furniture-delete': button =>
      warehouseView.askDelete('furniture', button.dataset.id),

    /**
     * Handles the warehouse select furniture interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-select-furniture': button =>
      warehouseView.selectFurniture(button.dataset.id),

    /**
     * Handles the warehouse shelf new interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-shelf-new': button =>
      warehouseView.openForm('shelf', button.dataset.id),

    /**
     * Handles the warehouse shelf view interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-shelf-view': button =>
      warehouseView.openShelfDetails(button.dataset.shelfId || button.dataset.id),

    /**
     * Handles the warehouse shelf up interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-shelf-up': button => warehouseView.moveShelf(button.dataset.id, 'up'),

    /**
     * Handles the warehouse shelf down interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-shelf-down': button => warehouseView.moveShelf(button.dataset.id, 'down'),

    /**
     * Handles the warehouse shelf edit interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-shelf-edit': button =>
      warehouseView.openForm('shelf', button.dataset.id),

    /**
     * Handles the warehouse shelf switch interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-shelf-switch': button =>
      warehouseView.switchShelf(button.dataset.target),

    /**
     * Handles the warehouse photo move interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-photo-move': button => warehouseView.moveFurniturePhoto(button.dataset.id, button.dataset.photoId, button.dataset.direction),

    /**
     * Handles the warehouse photo delete interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-photo-delete': button => warehouseView.deleteFurniturePhoto(button.dataset.id, button.dataset.photoId),

    /**
     * Handles the warehouse photo open interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-photo-open': button => warehouseView.openFurniturePhoto(button.dataset.path, button.dataset.title),

    /**
     * Handles the warehouse shelf copy interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-shelf-copy': button =>
      warehouseView.openForm('shelf-copy', button.dataset.id),

    /**
     * Handles the warehouse shelf delete interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-shelf-delete': button =>
      warehouseView.askDelete('shelf', button.dataset.id),

    /**
     * Handles the warehouse assign interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-assign': button =>
      warehouseView.openForm('assign', button.dataset.id),

    /**
     * Handles the warehouse bottles assign selected interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-bottles-assign-selected': () =>
      warehouseView.assignSelectedBottles(),

    /**
     * Handles the warehouse bottles select clear interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-bottles-select-clear': () =>
      warehouseView.clearBottleSelection(),

    /**
     * Handles the warehouse bottles select all interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-bottles-select-all': () => warehouseView.selectAllBottles(),

    /**
     * Handles the warehouse bottle preview interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-bottle-preview': button =>
      warehouseView.openBottlePreview(button.dataset.id),

    /**
     * Handles the warehouse bottle select interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-bottle-select': button =>
      warehouseView.toggleWallBottleSelection(button.dataset.id),

    /**
     * Handles the warehouse bottles preview selected interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-bottles-preview-selected': () =>
      warehouseView.previewSelectedBottle(),

    /**
     * Handles the warehouse unassigned prev interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-unassigned-prev': () => warehouseView.stepUnassignedWallPage(-1),

    /**
     * Handles the warehouse unassigned next interaction.
     * @return {*} Result computed from the supplied inputs.
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
     * Handles the warehouse confirm delete interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-confirm-delete': () => warehouseView.deleteConfirmed(),

    /**
     * Handles the warehouse confirm delete unassign interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-confirm-delete-unassign': () =>
      warehouseView.deleteConfirmed(true),
  };
}
