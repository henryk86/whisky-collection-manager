/**
 * Finds the room and shelf path for a stored bottle.
 *
 * @param {!Object} warehouse Warehouse model being processed.
 * @param {*} shelfId Identifier of the shelf whose room and furniture path is requested.
 * @return {?Object} Computed value, or null when the input has no match.
 */
export function storagePath(warehouse, shelfId) {
  for (const room of warehouse?.rooms || []) for (const furniture of room.furniture) for (const shelf of furniture.shelves) {
    if (shelf.id === shelfId) return {
      room,
      furniture,
      shelf,
      label: `${room.name} / ${furniture.name} / ${shelf.name}`,
    };
  }
  return null;
}
