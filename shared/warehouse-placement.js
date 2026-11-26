/** Shared 3D occupancy rules for placement (API, 2D dragging, and copying).
 * Coordinates are metres; rotations are quarter turns around the vertical axis.
 */
const EPSILON = 0.00001;

/**
 * Computes the occupied rectangle of a furniture item.
 *
 * @param {*} furniture Furniture configuration including its dimensions.
 * @return {!Object} Structured result for the caller.
 */
export function furnitureBounds(furniture) {
  const swapped = Number(furniture.rotation ?? 0) % 180 !== 0;
  return {
    x: Number(furniture.x), y: Number(furniture.y),
    w: Number(swapped ? furniture.depth : furniture.width),
    h: Number(swapped ? furniture.width : furniture.depth),
    z: Number(furniture.elevation ?? 0),
    d: Number(furniture.itemHeight ?? (furniture.type === 'haengeregal' ? 0.4 : 1.8)),
  };
}

/**
 * Tests whether two furniture footprints overlap.
 *
 * @param {*} first First used by this operation.
 * @param {*} second Second used by this operation.
 * @return {boolean} Whether the condition is satisfied.
 */
export function furnitureOverlap(first, second) {
  const a = furnitureBounds(first), b = furnitureBounds(second);
  // Touching faces are valid. The XY rectangles AND vertical height intervals
  // must intersect for a physical collision to occur.
  return a.x < b.x + b.w - EPSILON && b.x < a.x + a.w - EPSILON && a.y < b.y + b.h - EPSILON && b.y < a.y + a.h - EPSILON &&
    a.z < b.z + b.d - EPSILON && b.z < a.z + a.d - EPSILON;
}

/**
 * Finds the first colliding furniture item, ignoring the candidate's own ID.
 * @param {Object} room Room being checked.
 * @param {Object} candidate Candidate furniture geometry.
 * @param {Object[]=} otherFurniture Comparison items, defaulting to the room's furniture.
 * @return {(Object|null)} First collision or null.
 */
export function furnitureCollision(room, candidate, otherFurniture =
  room.furniture || []) {
  return otherFurniture.find(other => (candidate.id === undefined || other.id !== candidate.id) && furnitureOverlap(candidate, other)) ?? null;
}

/**
 * Checks whether a furniture footprint fits within room bounds.
 *
 * @param {*} room Room model containing dimensions and furniture.
 * @param {*} item Warehouse item or record being evaluated.
 * @return {boolean} Whether the condition is satisfied.
 */
export function furnitureFitsRoom(room, item) {
  const b = furnitureBounds(item);
  return b.x >= 0 && b.y >= 0 && b.x + b.w <= room.width + EPSILON && b.y + b.h <= room.height + EPSILON;
}

/**
 * Continuous collision-constrained movement in the 2D editor. Small steps
 * prevent skipping across a blocking object when the pointer moves quickly.
 * Trying each axis independently lets furniture slide along a wall or cabinet.
 *
 * @param {*} room Room model containing dimensions and furniture.
 * @param {*} item Warehouse item or record being evaluated.
 * @param {*} fromX From x used by this operation.
 * @param {*} fromY From y used by this operation.
 * @param {*} toX To x used by this operation.
 * @param {*} toY To y used by this operation.
 * @return {!Object} Structured result for the caller.
 */
export function moveFurnitureTowards(room, item, fromX, fromY, toX, toY) {
  const dx = toX - fromX, dy = toY - fromY;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.04));
  let x = fromX, y = fromY;
  /**
   * Tests whether the furniture fits at a candidate room position without colliding.
   * @param {number} nextX Candidate horizontal room position in metres.
   * @param {number} nextY Candidate depth position in metres.
   * @return {boolean} Whether the proposed position is valid.
   */
  const canPlace = (nextX, nextY) => {
    const candidate = {...item, x: nextX, y: nextY};
    return furnitureFitsRoom(room, candidate) && !furnitureCollision(room, candidate);
  };
  for (let i = 1; i <= steps; i++) {
    // Use actual progress for each axis, not the starting position, so
    // collisions never permit a teleport through another furniture item.
    const nextX = x + dx / steps, nextY = y + dy / steps;
    if (canPlace(nextX, nextY)) {x = nextX; y = nextY;}
    else {
      if (canPlace(nextX, y)) x = nextX;
      if (canPlace(x, nextY)) y = nextY;
    }
    // When one axis was blocked, don't accumulate offset past its obstacle.
    // Remaining steps can continue sliding along the unobstructed axis.
  }
  const roundedX = Math.round(x * 100) / 100, roundedY = Math.round(y * 100) / 100;
  return canPlace(roundedX, roundedY) ? {x: roundedX, y: roundedY} : {x: fromX, y: fromY};
}
