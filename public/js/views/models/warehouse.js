import {storagePath} from '../../domain/warehouse-storage-path.js';
import {totalCapacity, roomCapacity} from '../../domain/warehouse-capacity.js';
import {WAREHOUSE_CAMERAS} from '../../domain/warehouse-3d-model.js';

/**
 * Prepares warehouse presentation data without rendering or mutating state.
 * @param {!Object} data Current warehouse inventory.
 * @return {!Object} Prepared presentation data.
 */
export function createWarehouseViewModel(data) {
  const total = data.bottles.length;
  const assigned = data.bottles.filter(b => !!data.assignments[b.id]).length;
  const overallCapacity = totalCapacity(data);
  return {
    total, assigned, overallCapacity, roomCount: data.rooms.length,
    furnitureCount: data.rooms.reduce((n, r) => n + r.furniture.length, 0),
  };
}

/**
 * Prepares the capacity and plan controls for each room without mutating state.
 * @param {!Object} data Warehouse inventory.
 * @param {!Object} state Current room and plan preferences.
 * @return {!Object} Room summaries and normalized plan controls.
 */
export function createWarehouseRoomViewModel(data, state) {
  return {
    rooms: data.rooms.map(room => ({room, capacity: roomCapacity(room, data)})),
    level: ['all', 'floor', 'elevated'].includes(state.warehousePlanLevel) ? state.warehousePlanLevel : 'all',
    planMode: ['2d', '3d'].includes(state.warehousePlanMode) ? state.warehousePlanMode : '3d',
    planCorner: WAREHOUSE_CAMERAS.some(([id]) => id === state.warehousePlanCorner) ? state.warehousePlanCorner : 'nw',
    zoom: [100, 150, 200].includes(state.warehousePlanZoom) ? state.warehousePlanZoom : 100,
  };
}

/**
 * Computes occupancy, visibility and selection for the furniture list.
 * @param {!Object} data Warehouse inventory and assignments.
 * @param {!Object} state Current selection and visibility preferences.
 * @param {?Object} room Selected room, if available.
 * @return {!Object} Prepared furniture list and selection summary.
 */
export function createWarehouseSelectionModel(data, state, room) {
  const selected = new Set(state.warehouseSelectedFurnitureIds || []);
  const hidden = new Set(state.warehouseHiddenFurnitureIds || []);
  const occupancy = new Map();
  for (const id of Object.values(data.assignments)) occupancy.set(id, (occupancy.get(id) || 0) + 1);
  const items = (room?.furniture || []).map(furniture => ({
    furniture,
    occupied: furniture.shelves.reduce((sum, shelf) => sum + (occupancy.get(shelf.id) || 0), 0),
    visible: !hidden.has(furniture.id),
    selected: selected.has(furniture.id),
    current: state.warehouseFurnitureId === furniture.id,
  }));
  return {items, selectedCount: items.filter(item => item.selected).length, hasHidden: items.some(item => !item.visible)};
}

/**
 * Resolves the active workspace, including bottle focus and furniture selection.
 * @param {!Object} data Warehouse inventory.
 * @param {!Object} state Navigation and view preferences.
 * @param {!Object} options Section, active room, tray and finder results.
 * @return {!Object} Data required by the warehouse workspace renderer.
 */
export function createWarehouseWorkspaceModel(data, state, {section, room, selectedBottleIds, tray, finder}) {
  const furniture = room?.furniture.find(item => item.id === state.warehouseFurnitureId);
  const focusBottle = state.warehouseFindReturn ? data.bottles.find(bottle => bottle.id === state.warehouseFindFocusBottleId) : null;
  const focusPlace = focusBottle ? storagePath(data, data.assignments[focusBottle.id]) : null;
  return {
    data, section, room, furniture,
    summary: createWarehouseViewModel(data),
    roomModel: createWarehouseRoomViewModel(data, state),
    selection: createWarehouseSelectionModel(data, state, room),
    selectedBottleIds, tray,
    withoutShelves: room?.furniture.filter(item => item.shelves.length === 0) || [],
    focus: {
      focusBottle, focusPlace, inRoom: Boolean(room && focusPlace?.room.id === room.id),
      canReturn: Boolean(state.warehouseFindReturn),
      returnLabelKey: state.warehouseFindReturnFlightId ? 'flightPlan.backToFlight' : state.warehouseFindReturnBottlingId ? 'warehouse.find.backToBottling' : 'warehouse.find.backToResults',
    },
    finder: {query: state.warehouseSearch || '', placement: state.warehouseFinderPlacement || 'all', results: finder},
  };
}
