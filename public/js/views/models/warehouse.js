import {totalCapacity} from '../../domain/warehouse-capacity.js';

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
