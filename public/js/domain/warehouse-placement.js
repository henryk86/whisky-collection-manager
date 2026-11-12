/** Shared 3D occupancy rules for placement (API, 2D dragging, and copying).
 * Coordinates are metres; rotations are quarter turns around the vertical axis.
 */
const EPSILON = 0.00001;

export function furnitureBounds(furniture) {
    const swapped = Number(furniture.rotation ?? 0) % 180 !== 0;
    return {
        x: Number(furniture.x), y: Number(furniture.y),
        w: Number(swapped ? furniture.depth : furniture.width),
        h: Number(swapped ? furniture.width : furniture.depth),
        z: Number(furniture.elevation ?? 0),
        d: Number(furniture.itemHeight ?? (furniture.type === 'haengeregal' ? 0.4 : 1.8))
    };
}

export function furnitureOverlap(first, second) {
    const a = furnitureBounds(first), b = furnitureBounds(second);
    // Touching faces are valid. The XY rectangles AND vertical height intervals
    // must intersect for a physical collision to occur.
    return a.x < b.x + b.w - EPSILON && b.x < a.x + a.w - EPSILON &&
        a.y < b.y + b.h - EPSILON && b.y < a.y + a.h - EPSILON &&
        a.z < b.z + b.d - EPSILON && b.z < a.z + a.d - EPSILON;
}

export function furnitureCollision(room, candidate, otherFurniture = room.furniture || []) {
    return otherFurniture.find(other => (candidate.id === undefined || other.id !== candidate.id) && furnitureOverlap(candidate, other)) ?? null;
}

export function furnitureFitsRoom(room, item) {
    const b = furnitureBounds(item);
    return b.x >= 0 && b.y >= 0 && b.x + b.w <= room.width + EPSILON && b.y + b.h <= room.height + EPSILON;
}

/** Continuous collision-constrained movement in the 2D editor. Small steps
 * prevent skipping across a blocking object when the pointer moves quickly.
 * Trying each axis independently lets furniture slide along a wall or cabinet.
 */
export function moveFurnitureTowards(room, item, fromX, fromY, toX, toY) {
    const dx = toX - fromX, dy = toY - fromY;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.04));
    let x = fromX, y = fromY;
    const canPlace = (nextX, nextY) => {
        const candidate = {...item, x: nextX, y: nextY};
        return furnitureFitsRoom(room, candidate) && !furnitureCollision(room, candidate);
    };
    for (let i = 1; i <= steps; i++) {
        // Use actual progress for each axis, not the starting position, so
        // collisions never permit a teleport through another furniture item.
        const nextX = x + dx / steps, nextY = y + dy / steps;
        if (canPlace(nextX, nextY)) { x = nextX; y = nextY; }
        else {
            if (canPlace(nextX, y)) x = nextX;
            if (canPlace(x, nextY)) y = nextY;
        }
        // When one axis was blocked, don't accumulate offset past its obstacle.
        // Remaining steps can continue sliding along the unobstructed axis.
    }
    const roundedX = Math.round(x * 100) / 100, roundedY = Math.round(y * 100) / 100;
    return canPlace(roundedX, roundedY) ? {x:roundedX, y:roundedY} : {x:fromX, y:fromY};
}
