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
