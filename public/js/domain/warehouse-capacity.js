/**
 * Capacity is expressed in physical bottle slots, never litres or floor area.
 * Shelves without a configured maximum are tracked separately: their total
 * physical capacity cannot be inferred from the data.
 *
 * @param {*} room Room model containing dimensions and furniture.
 * @param {!Object} warehouse Warehouse model being processed.
 * @return {!Object} Structured result for the caller.
 */
export function roomCapacity(room, warehouse) {
  const shelves = (room?.furniture || []).flatMap(furniture => furniture.shelves || []);
  const shelfIds = new Set(shelves.map(shelf => shelf.id));
  const knownBottleIds = new Set((warehouse?.bottles || []).map(bottle => bottle.id));
  const occupied = Object.entries(warehouse?.assignments || {}).filter(([bottleId, shelfId]) => knownBottleIds.has(bottleId) && shelfIds.has(shelfId)).length;
  return {
    occupied,
    defined: shelves.reduce(
      (total, shelf) => total + (Number.isInteger(shelf.capacity) && shelf.capacity >= 0 ? shelf.capacity : 0),
      0
    ),
    unlimited: shelves.filter(shelf => !Number.isInteger(shelf.capacity) || shelf.capacity < 0).length,
    shelves: shelves.length,
  };
}

/**
 * Counts the bottle positions available in a warehouse layout.
 *
 * @param {!Object} warehouse Warehouse model being processed.
 * @return {*} Combined value obtained from the entries.
 */
export function totalCapacity(warehouse) {
  return (warehouse?.rooms || []).reduce((total, room) => {
    const value = roomCapacity(room, warehouse);
    total.occupied += value.occupied;
    total.defined += value.defined;
    total.unlimited += value.unlimited;
    total.shelves += value.shelves;
    return total;
  }, {occupied: 0, defined: 0, unlimited: 0, shelves: 0});
}

/**
 * Formats a shelf or furniture capacity for the interface.
 *
 * @param {*} summary Capacity summary with shelf count, unlimited shelf count and defined slots.
 * @return {string} German capacity label distinguishing fixed spaces, unlimited compartments and missing shelves.
 */
export function capacityLabel(summary) {
  if (summary.shelves === 0) return 'Noch keine Fächer';
  if (summary.unlimited === 0) return `${summary.defined} Plätze`;
  if (summary.defined === 0) return `${summary.unlimited} ${summary.unlimited === 1 ? 'Fach' : 'Fächer'} ohne Limit`;
  return `mind. ${summary.defined} Plätze · ${summary.unlimited} ${summary.unlimited === 1 ? 'Fach' : 'Fächer'} ohne Limit`;
}
