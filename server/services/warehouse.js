/**
 * Physical storage locations and individual bottle allocations. No collection
 * mutations.
 */
import crypto from 'node:crypto';
import {projectedWarehouseBottles}
  from '../../shared/warehouse-bottle-projection.js';
import {createRoomExport, planRoomImport} from './room-transfer.js';
import {read} from '../storage/collection-store.js';
import {readWarehouse, changeWarehouse} from '../storage/warehouse-store.js';
import {fail} from '../domain/errors.js';
import {saveImage, deleteImage} from '../storage/photos.js';
import {furnitureBounds, furnitureCollision, furnitureOverlap}
  from '../../shared/warehouse-placement.js';
import {
  name, number, capacity, shelfFront, doorLeaves, glassFrame, doorRanges,
  shelfHeight, ensureShelfHeights, layout
} from '../domain/warehouse-fields.js';

/**
 * Generates an identifier for a new storage record.
 * @return {string} Random UUID.
 */
const newId = () => crypto.randomUUID();

/**
 * Finds a room in the storage document or raises a not-found error.
 * @param {Object} data Warehouse document containing rooms.
 * @param {string} id Room ID.
 * @return {Object} Matching room reference.
 */
function roomById(data, id) {
  const room = data.rooms.find(entry => entry.id === id);
  if (!room) throw fail('Raum nicht gefunden', 404, "api.errors.roomNotFound");
  return room;
}

/**
 * Locates furniture together with its containing room, or raises a not-found error.
 * @param {Object} data Warehouse document containing rooms and furniture.
 * @param {string} id Furniture ID.
 * @return {{room: Object, furniture: Object}} Matching room and furniture references.
 */
function furnishingById(data, id) {
  for (const room of data.rooms) {
    const furniture = room.furniture.find(item => item.id === id);
    if (furniture) return {room, furniture};
  }
  throw fail('Lagermöbel nicht gefunden', 404, "api.errors.storageFurnitureNotFound");
}

/**
 * Locates a compartment and its owning furniture and room, or raises a not-found error.
 * @param {Object} data Warehouse document.
 * @param {string} id Compartment ID.
 * @return {{room: Object, furniture: Object, shelf: Object}} Matching hierarchy references.
 */
function shelfById(data, id) {
  for (const room of data.rooms) for (const furniture of room.furniture) {
    const shelf = furniture.shelves.find(item => item.id === id);
    if (shelf) return {room, furniture, shelf};
  }
  throw fail('Fach nicht gefunden', 404, "api.errors.compartmentNotFound");
}

/**
 * Removes stale bottle assignments, then rejects deletion of any still occupied compartment.
 * @param {Object} data Mutable warehouse document.
 * @param {string[]} shelfIds Compartment IDs scheduled for deletion.
 */
function refuseOccupied(data, shelfIds) {
  // Deleting a physical bottle only changes collection.json. Old warehouse
  // references must not permanently block a now-empty room or shelf.
  const liveIds = new Set(physicalBottles().map(bottle => bottle.id));
  for (const id of Object.keys(data.assignments)) if (!liveIds.has(id)) delete data.assignments[id];
  if (Object.values(data.assignments).some(id => shelfIds.has(id))) throw fail(
    'Lagerort enthält Flaschen. Bitte zuerst umlagern.',
    409,
    "api.errors.storageLocationContainsBottlesMoveThemFirst"
  );
}

/**
 * Projects physical bottle records from the current persisted collection into the storage model.
 * @return {Object[]} Projected physical bottle records.
 */
function physicalBottles() {return projectedWarehouseBottles(read());}

/**
 * Retrieves warehouse for warehouse.
 *
 * @return {!Object} Structured result for the caller.
 */
export function getWarehouse() {
  const data = readWarehouse();
  const bottles = physicalBottles();
  const known = new Set(bottles.map(b => b.id));
  const assignments = Object.fromEntries(Object.entries(data.assignments).filter(([id]) => known.has(id)));
  return {
    schemaVersion: data.schemaVersion, rooms: data.rooms, assignments, bottles,
    // References to removed collection bottles remain distinguishable until
    // cleaned.
    staleAssignments: Object.keys(data.assignments).filter(id => !known.has(id)).length,
  };
}

/**
 * Creates room for warehouse.
 *
 * @param {*} input Input to process.
 * @return {!Promise<!Object>} Promise fulfilled when the operation completes.
 */
export const createRoom = input => changeWarehouse(data => {
  const item = {
    id: newId(),
    name: name(input?.name),
    width: number(input?.width ?? 4, 'Raumbreite', 1, 100),
    height: number(input?.height ?? 4, 'Raumtiefe', 1, 100),
    furniture: [],
  };
  data.rooms.push(item); return item;
});

/**
 * Updates room for warehouse.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @param {*} input Input to process.
 * @return {!Promise<*>} Promise fulfilled when the operation completes.
 */
export const updateRoom = (id, input) => changeWarehouse(data => {
  const room = roomById(data, id);
  const next = {
    ...room,
    name: name(input?.name),
    width: number(input?.width, 'Raumbreite', 1, 100),
    height: number(input?.height, 'Raumtiefe', 1, 100),
  };
  for (const furniture of room.furniture) layout({...furniture}, next);
  Object.assign(room, next); return room;
});

/**
 * Remove a room in one warehouse write. With explicit opt-in, assigned bottles
 * become unassigned; their collection records remain unchanged.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @param {!Object=} options2 Destructured options for this operation.
 * @return {!Promise<!Object>} Promise fulfilled when the operation completes.
 */
export const deleteRoom = async (id, {unassignBottles = false} = {}) => {
  let deletedPhotos = [];
  const result = await changeWarehouse(data => {
    const room = roomById(data, id);
    const shelves = new Set(room.furniture.flatMap(f => f.shelves.map(s => s.id)));
    if (unassignBottles === true) {
      // Remove every reference to these shelves, including stale bottle IDs.
      // This must happen in the same transaction as removing the room.
      for (const [bottleId, shelfId] of Object.entries(data.assignments)) {
        if (shelves.has(shelfId)) delete data.assignments[bottleId];
      }
    } else {
      refuseOccupied(data, shelves);
    }
    deletedPhotos = room.furniture.flatMap(furniture => (furniture.photos || []).map(photo => photo.path));
    data.rooms.splice(data.rooms.indexOf(room), 1);
    return {ok: true};
  });
  for (const file of deletedPhotos) deleteImage(file);
  return result;
};

/**
 * Creates furniture for warehouse.
 *
 * @param {string} roomId Identifier of the room receiving the new furniture.
 * @param {*} input Input to process.
 * @return {!Promise<!Object>} Promise fulfilled when the operation completes.
 */
export const createFurniture = (roomId, input) => changeWarehouse(data => {
  const room = roomById(data, roomId);
  const item = {
    id: newId(), ...layout(input || {}, room), shelves: [], photos: [],
  };
  ensureNoFurnitureCollision(room, item);
  room.furniture.push(item); return item;
});

/**
 * Updates furniture for warehouse.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @param {*} input Input to process.
 * @return {!Promise<*>} Promise fulfilled when the operation completes.
 */
export const updateFurniture = (id, input) => changeWarehouse(data => {
  const {room, furniture} = furnishingById(data, id);
  const next = layout({...input, shelves: furniture.shelves}, room);
  ensureShelfHeights(furniture, furniture.shelves, next.itemHeight);
  // Existing installations may contain furniture that was positioned before
  // collision checking existed. Do not block harmless metadata edits; only
  // enforce the new rule when the occupied volume actually changes.
  const oldBounds = furnitureBounds(furniture), newBounds = furnitureBounds(next);
  if (['x', 'y', 'w', 'h', 'z', 'd'].some(key => Math.abs(oldBounds[key] - newBounds[key]) > 0.00001))
    ensureNoFurnitureCollision(room, {...next, id: furniture.id});
  Object.assign(furniture, next); return furniture;
});

/**
 * Apply the same explicitly selected properties to many furniture items
 * atomically. Each resulting layout is checked before any in-memory item is
 * changed; changeWarehouse persists exactly once only after a successful
 * mutation.
 *
 * @param {*} input Input to process.
 * @return {!Promise<!Object>} Promise fulfilled when the operation completes.
 */
export const bulkUpdateFurniture = input => changeWarehouse(data => {
  const ids = input?.ids;
  const changes = input?.changes;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 200 ||
    !ids.every(id => typeof id === 'string' && id.length > 0) ||
    new Set(ids).size !== ids.length) {
    throw fail(
      'Bitte 1 bis 200 unterschiedliche Lagermöbel auswählen',
      400,
      "api.errors.selectBetween1And200DifferentStorageUnits"
    );
  }
  const allowed = new Set([
    'rotation',
    'elevation',
    'itemHeight',
    'width',
    'depth',
    'leftSidePanel',
    'rightSidePanel',
    'backPanel',
    'doorLeaves',
    'glassFrame',
  ]);
  if (!changes || typeof changes !== 'object' || Array.isArray(changes) || !Object.keys(changes).length || Object.keys(changes).some(key => !allowed.has(key))) {
    throw fail('Keine gültigen gemeinsamen Eigenschaften angegeben', 400, "api.errors.noValidSharedPropertiesSpecified");
  }
  const updates = ids.map(id => {
    const {room, furniture} = furnishingById(data, id);
    const next = layout({...furniture, ...changes, shelves: furniture.shelves}, room);
    ensureShelfHeights(furniture, furniture.shelves, next.itemHeight);
    return {furniture, next};
  });
  if (['rotation', 'elevation', 'itemHeight', 'width', 'depth'].some(key => Object.hasOwn(changes, key))) {
    // Evaluate the FINAL state, including collisions between simultaneously
    // changed items.
    const proposed = new Map(updates.map(({furniture, next}) => [furniture.id, {...next, id: furniture.id}]));
    for (const {furniture, next} of updates) {
      const {room} = furnishingById(data, furniture.id);
      ensureNoFurnitureCollision(
        room,
        {...next, id: furniture.id},
        room.furniture.map(item => proposed.get(item.id) || item)
      );
    }
  }
  for (const {furniture, next} of updates) Object.assign(furniture, next);
  return {
    updated: updates.map(({furniture}) => furniture.id),
    count: updates.length,
  };
});

/**
 * Atomic multi-delete. Verify every selected location before removing
 * anything.
 *
 * @param {*} input Input to process.
 * @return {!Promise<!Object>} Promise fulfilled when the operation completes.
 */
export const bulkDeleteFurniture = async input => {
  let deletedPhotos = [];
  const result = await changeWarehouse(data => {
    const ids = input?.ids;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 200 ||
      !ids.every(id => typeof id === 'string' && id.length > 0) ||
      new Set(ids).size !== ids.length)
      throw fail(
        'Bitte 1 bis 200 unterschiedliche Lagermöbel auswählen',
        400,
        "api.errors.selectBetween1And200DifferentStorageUnits"
      );
    const targets = ids.map(id => furnishingById(data, id));
    refuseOccupied(data, new Set(targets.flatMap(({furniture}) => furniture.shelves.map(shelf => shelf.id))));
    deletedPhotos = targets.flatMap(({furniture}) => (furniture.photos || []).map(photo => photo.path));
    for (const {room, furniture} of targets) room.furniture.splice(room.furniture.indexOf(furniture), 1);
    return {ok: true, deleted: ids, count: ids.length};
  });
  for (const file of deletedPhotos) deleteImage(file);
  return result;
};

/**
 * Clears furniture for warehouse.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @return {!Promise<!Object>} Promise fulfilled when the operation completes.
 */
export const deleteFurniture = async id => {
  let removedPhotos = [];
  const result = await changeWarehouse(data => {
    const {room, furniture} = furnishingById(data, id);
    refuseOccupied(data, new Set(furniture.shelves.map(s => s.id)));
    removedPhotos = (furniture.photos || []).map(photo => photo.path);
    room.furniture.splice(room.furniture.indexOf(furniture), 1); return {ok: true};
  });
  for (const file of removedPhotos) deleteImage(file);
  return result;
};

/**
 * Furniture images use the existing, backup-covered images tree.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @param {*} input Input to process.
 * @return {!Promise<!Object>} Promise fulfilled when the operation completes.
 */
export async function addFurniturePhoto(id, input) {
  furnishingById(readWarehouse(), id);
  const photoId = newId();
  const photoPath = saveImage(input?.image, id, `furniture-${photoId}`);
  try {
    return await changeWarehouse(data => {
      const {furniture} = furnishingById(data, id);
      furniture.photos ??= [];
      if (furniture.photos.length >= 24) throw fail('Maximal 24 Möbelfotos erlaubt', 400, "api.errors.tooManyFurniturePhotos");
      const photo = {
        id: photoId, path: photoPath, createdAt: new Date().toISOString(),
      };
      furniture.photos.push(photo);
      return photo;
    });
  } catch (error) {deleteImage(photoPath); throw error;}
}

/**
 * Persists the new order of photos attached to warehouse furniture.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @param {*} input Input to process.
 * @return {!Promise<*>} Promise fulfilled when the operation completes.
 */
export const reorderFurniturePhotos = (id, input) => changeWarehouse(data => {
  const {furniture} = furnishingById(data, id);
  const photos = furniture.photos || [];
  const ids = input?.photoIds;
  if (!Array.isArray(ids) || ids.length !== photos.length || new Set(ids).size !== ids.length ||
    ids.some(photoId => !photos.some(photo => photo.id === photoId))) throw fail('Ungültige Möbelfoto-Reihenfolge', 400, "api.errors.invalidFurniturePhotoOrder");
  furniture.photos = ids.map(photoId => photos.find(photo => photo.id === photoId));
  return furniture.photos;
});

/**
 * Clears furniture photo for warehouse.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @param {string} photoId Identifier of the photo.
 * @return {!Promise<!Object>} Promise fulfilled when the operation completes.
 */
export async function deleteFurniturePhoto(id, photoId) {
  const result = await changeWarehouse(data => {
    const {furniture} = furnishingById(data, id);
    const index = (furniture.photos || []).findIndex(photo => photo.id === photoId);
    if (index < 0) throw fail('Möbelfoto nicht gefunden', 404, "api.errors.furniturePhotoNotFound");
    return furniture.photos.splice(index, 1)[0];
  });
  deleteImage(result.path);
  return {ok: true};
}

/**
 * Creates shelf for warehouse.
 *
 * @param {string} furnitureId Identifier of the furniture receiving the new shelf.
 * @param {*} input Input to process.
 * @return {!Promise<!Object>} Promise fulfilled when the operation completes.
 */
export const createShelf = (furnitureId, input) => changeWarehouse(data => {
  const {furniture} = furnishingById(data, furnitureId);
  const item = {
    id: newId(),
    name: name(input?.name),
    capacity: capacity(input?.capacity),
    front: shelfFront(input?.front),
    heightCm: shelfHeight(input?.heightCm),
    doorLeaves: doorLeaves(input?.doorLeaves),
    glassFrame: glassFrame(input?.glassFrame),
  };
  ensureShelfHeights(furniture, [...furniture.shelves, item]);
  furniture.shelves.push(item); return item;
});

/**
 * Updates shelf for warehouse.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @param {*} input Input to process.
 * @return {!Promise<*>} Promise fulfilled when the operation completes.
 */
export const updateShelf = (id, input) => changeWarehouse(data => {
  const {furniture, shelf} = shelfById(data, id);
  const next = {
    ...shelf,
    name: name(input?.name),
    front: shelfFront(input?.front),
    heightCm: shelfHeight(input?.heightCm),
    doorLeaves: doorLeaves(input?.doorLeaves),
    glassFrame: glassFrame(input?.glassFrame),
  };
  ensureShelfHeights(furniture, furniture.shelves.map(item => item.id === id ? next : item));
  const nextCapacity = capacity(input?.capacity);
  if (nextCapacity !== null) {
    const known = new Set(physicalBottles().map(b => b.id));
    const occupied = Object.entries(data.assignments).filter(([bid, sid]) => sid === id && known.has(bid)).length;
    if (occupied > nextCapacity) throw fail('Kapazität liegt unter der aktuellen Belegung', 409, "api.errors.capacityIsBelowCurrentOccupancy");
  }
  Object.assign(shelf, next, {capacity: nextCapacity});
  return shelf;
});

/**
 * Clears shelf for warehouse.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @return {!Promise<!Object>} Promise fulfilled when the operation completes.
 */
export const deleteShelf = id => changeWarehouse(data => {
  const {furniture, shelf} = shelfById(data, id);
  refuseOccupied(data, new Set([id]));
  const removed = furniture.shelves.indexOf(shelf) + 1;
  furniture.shelves.splice(removed - 1, 1);
  furniture.doorRanges = (furniture.doorRanges || []).flatMap(range => {
    if (removed < range.from) return [{
      ...range, from: range.from - 1, to: range.to - 1,
    }];
    if (removed > range.to) return [range];
    return range.from === range.to ? [] : [{...range, to: range.to - 1}];
  });
  return {ok: true};
});

/**
 * Change only the vertical order of existing shelf IDs, never assignments.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @param {*} input Input to process.
 * @return {!Promise<!Object>} Promise fulfilled when the operation completes.
 */
export const moveShelf = (id, input) => changeWarehouse(data => {
  const {furniture, shelf} = shelfById(data, id);
  if (!['up', 'down'].includes(input?.direction)) throw fail('Ungültige Verschieberichtung', 400, "api.errors.invalidMovementDirection");
  const index = furniture.shelves.indexOf(shelf);
  const next = index + (input.direction === 'up' ? 1 : -1);
  if (next < 0 || next >= furniture.shelves.length) throw fail('Fach ist bereits am Rand', 409, "api.errors.compartmentIsAlreadyAtTheEdge");
  [furniture.shelves[index], furniture.shelves[next]] = [furniture.shelves[next], furniture.shelves[index]];
  return {id, position: next};
});

/**
 * Copies are new locations, never new assignments to existing physical
 * bottles.
 *
 * @param {string} source Original name before adding a copy suffix.
 * @param {*} siblings Sibling items whose names must not collide with the copy.
 * @return {string} First noncolliding copy name, keeping the 100-character name limit.
 */
function copiedName(source, siblings) {
  const names = new Set(siblings.map(item => item.name));
  for (let n = 1; n <= 10000; n++) {
    const suffix = n === 1 ? ' (Kopie)' : ` (Kopie ${n})`;
    const candidate = `${source.slice(0, 100 - suffix.length)}${suffix}`;
    if (!names.has(candidate)) return candidate;
  }
  throw fail('Kein freier Kopiename verfügbar', 409, "api.errors.noUnusedCopyNameIsAvailable");
}

/**
 * Rejects intersecting furniture footprints that also overlap in height.
 * @param {Object} room Room being edited.
 * @param {Object} item Candidate furniture geometry.
 * @param {Object[]=} others Other furniture to test; defaults to the room's furniture.
 */
function ensureNoFurnitureCollision(room, item, others = room.furniture) {
  const conflict = furnitureCollision(room, item, others);
  if (conflict) throw fail(
    `Lagermöbel überschneidet sich mit „${conflict.name}“ (Grundfläche und Höhenbereich)`,
    409,
    "api.errors.furnitureOverlap",
    {name: conflict.name}
  );
}

/**
 * Find a non-overlapping, in-bounds position for the copied furniture.
 * Existing coordinates remain unchanged. Furniture may have been positioned by
 * hand.
 *
 * @param {*} room Room model containing dimensions and furniture.
 * @param {*} template Furniture to copy, including dimensions, orientation and original position.
 * @return {!Object} Structured result for the caller.
 */
function copyPosition(room, template) {
  const r = furnitureBounds(template);
  if (r.w > room.width || r.h > room.height) throw fail('Die Kopie passt nicht in den Zielraum', 409, "api.errors.theCopyDoesNotFitInTheDestinationRoom");
  /**
   * Calculates the round numeric value.
   *
   * @param {*} v Value to evaluate.
   * @return {number} Calculated numeric value.
   */
  const round = v => Math.round(v * 100) / 100;
  const xs = new Set([
    0,
    round(room.width - r.w),
    round(template.x),
    round(template.x + r.w + 0.1),
  ]);
  const ys = new Set([
    0,
    round(room.height - r.h),
    round(template.y),
    round(template.y + r.h + 0.1),
  ]);
  for (const item of room.furniture) {
    const other = furnitureBounds(item);
    xs.add(round(other.x + other.w));
    ys.add(round(other.y + other.h));
  }
  const positions = [...xs].flatMap(x => [...ys].map(y => ({x, y}))).filter(({x, y}) => x >= 0 && y >= 0 && x + r.w <= room.width + 0.00001 && y + r.h <= room.height + 0.00001)
    .sort((a, b) => (Math.abs(a.x - template.x) + Math.abs(a.y - template.y)) - (Math.abs(b.x - template.x) + Math.abs(b.y - template.y)) || a.y - b.y || a.x - b.x);
  for (const p of positions) {
    if (room.furniture.every(item => {
      return !furnitureOverlap({...template, ...p}, item);
    })) return p;
  }
  throw fail(
    'Kein freier Platz für die Kopie. Bitte zuerst Platz im Zielraum schaffen.',
    409,
    "api.errors.notEnoughSpaceForTheCopyMakeRoomInTheDestinationRoomFirst"
  );
}

/**
 * Copies furniture configuration into the requested warehouse position.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @param {!Object=} input Input to process.
 * @return {!Promise<!Object>} Promise fulfilled when the operation completes.
 */
export const copyFurniture = (id, input = {}) => changeWarehouse(data => {
  const source = furnishingById(data, id);
  const targetRoom = input.roomId === undefined ? source.room : roomById(data, input.roomId);
  if (input.withShelves !== undefined && typeof input.withShelves !== 'boolean') throw fail('Ungültige Kopieroption', 400, "api.errors.invalidCopyOption");
  const withShelves = input.withShelves !== false;
  const position = copyPosition(targetRoom, source.furniture);
  const item = {
    id: newId(),
    ...layout({
      ...source.furniture, ...position,
      name: input.name === undefined ? copiedName(source.furniture.name, targetRoom.furniture) : name(input.name),
    }, targetRoom),
    // Furniture copies never inherit the original photo metadata or bytes.
    photos: [],
    shelves: withShelves ? source.furniture.shelves.map(shelf => ({...shelf, id: newId()})) : [],
    doorRanges: withShelves ? (source.furniture.doorRanges || []).map(range => ({...range})) : [],
  };
  targetRoom.furniture.push(item);
  return item;
});

/**
 * Copies a shelf's configuration to a new furniture position.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @param {!Object=} input Input to process.
 * @return {!Promise<!Object>} Promise fulfilled when the operation completes.
 */
export const copyShelf = (id, input = {}) => changeWarehouse(data => {
  const source = shelfById(data, id);
  const target = input.furnitureId === undefined ? source.furniture : furnishingById(data, input.furnitureId).furniture;
  const item = {
    id: newId(),
    name: input.name === undefined ? copiedName(source.shelf.name, target.shelves) : name(input.name),
    capacity: source.shelf.capacity,
    front: source.shelf.front ?? null,
    heightCm: source.shelf.heightCm ?? null,
    doorLeaves: source.shelf.doorLeaves ?? null,
    glassFrame: source.shelf.glassFrame ?? null,
  };
  ensureShelfHeights(target, [...target.shelves, item]);
  target.shelves.push(item);
  return item;
});

/**
 * Raising a positive shelf capacity is opt-in and part of the same atomic
 * warehouse transaction as its bottle assignments. Capacity zero is a hard
 * no-storage designation and can never be overridden by this operation.
 *
 * @param {!Object} data Input data for the operation.
 * @param {*} shelf Destination shelf with its current capacity.
 * @param {string} shelfId Identifier of the destination shelf.
 * @param {string[]} selectedIds Bottle identifiers included in this assignment.
 * @param {Set<string>} known Identifiers of bottles that still exist in the collection.
 * @param {*} increaseCapacityTo Requested new capacity, when the caller permits a capacity increase.
 */
function enforceAssignmentCapacity(data, shelf, shelfId, selectedIds, known,
  increaseCapacityTo) {
  if (shelf.capacity === null) return;
  const selected = new Set(selectedIds);
  const others = Object.entries(data.assignments).filter(([id, assigned]) =>
    assigned === shelfId && !selected.has(id) && known.has(id)).length;
  const required = others + selected.size;
  if (required <= shelf.capacity) return;
  if (shelf.capacity === 0 || !Number.isInteger(increaseCapacityTo) || increaseCapacityTo < required || increaseCapacityTo > 10000 ||
    required > 10000) {
    throw fail('This shelf has insufficient free capacity', 409, "api.errors.insufficientShelfCapacity");
  }
  shelf.capacity = required;
}

/**
 * Assigns a physical bottle to a validated warehouse shelf.
 *
 * @param {string} bottleId Identifier of the physical bottle.
 * @param {*} input Input to process.
 * @return {!Promise<(!Object)>} Promise fulfilled when the operation
 * completes.
 */
export const assignBottle = (bottleId, input) => changeWarehouse(data => {
  const known = new Set(physicalBottles().map(item => item.id));
  if (!known.has(bottleId)) throw fail('Physische Flasche nicht gefunden', 404, "api.errors.physicalBottleNotFound");
  const id = input?.shelfId;
  if (id === null || id === '' || id === undefined) {
    delete data.assignments[bottleId]; return {bottleId, shelfId: null};
  }
  if (typeof id !== 'string') throw fail('Ungültige Fach-ID', 400, "api.errors.invalidCompartmentID");
  const {shelf} = shelfById(data, id);
  enforceAssignmentCapacity(data, shelf, id, [bottleId], known, input?.increaseCapacityTo);
  data.assignments[bottleId] = id;
  // Removing stale references is safe: absent bottles can no longer be
  // reassigned.
  for (const bid of Object.keys(data.assignments)) if (!known.has(bid)) delete data.assignments[bid];
  return {bottleId, shelfId: id};
});

/**
 * Atomically assign multiple physical bottles to one shelf (or unassign them).
 * The final occupancy is checked before any warehouse assignments are mutated.
 *
 * @param {*} input Input to process.
 * @return {!Promise<!Object>} Promise fulfilled when the operation completes.
 */
export const assignBottles = input => changeWarehouse(data => {
  const ids = input?.ids;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 500 ||
    ids.some(id => typeof id !== 'string' || !id.trim() || id.length > 120) ||
    new Set(ids).size !== ids.length) throw fail('Select 1 to 500 different bottles', 400, "api.errors.select1To500Bottles");
  const known = new Set(physicalBottles().map(bottle => bottle.id));
  if (ids.some(id => !known.has(id))) throw fail('Physical bottle not found', 404, "api.errors.physicalBottleNotFound");
  const target = input?.shelfId;
  if (target !== null && (typeof target !== 'string' || !target.trim())) throw fail('Invalid shelf ID', 400, "api.errors.invalidShelfID");
  const shelf = target === null ? null : shelfById(data, target).shelf;
  if (shelf) enforceAssignmentCapacity(data, shelf, target, ids, known, input?.increaseCapacityTo);
  // All validation succeeded. Persist one coherent assignment update.
  for (const id of ids) {
    if (target === null) delete data.assignments[id];
    else data.assignments[id] = target;
  }
  for (const id of Object.keys(data.assignments)) if (!known.has(id)) delete data.assignments[id];
  return {count: ids.length, shelfId: target};
});

/**
 * Export is read-only and portable across independently initialized instances.
 *
 * @param {*} input Input to process.
 * @return {!Object} Structured result for the caller.
 */
export function exportRooms(input) {
  return createRoomExport(getWarehouse(), input?.roomIds, input?.includeAssignments ?? false);
}

/**
 * Validates a room-model import and prepares its preview.
 *
 * @param {*} input Input to process.
 * @return {!Object} Structured result for the caller.
 */
export function previewRoomImport(input) {
  return planRoomImport(getWarehouse(), input?.document, {
    includeAssignments: input?.includeAssignments ?? true,
    conflictPolicy: input?.conflictPolicy ?? 'skip',
  }).summary;
}

/**
 * One atomic store mutation. Failed validation or conflicts never partially
 * import.
 *
 * @param {*} input Input to process.
 * @return {!Promise<!Object>} Promise fulfilled when the operation completes.
 */
export const importRooms = input => changeWarehouse(data => {
  const plan = planRoomImport(
    {...data, bottles: physicalBottles()},
    input?.document,
    {
      includeAssignments: input?.includeAssignments ?? true,
      conflictPolicy: input?.conflictPolicy ?? 'skip',
    }
  );
  if (plan.summary.blockedRooms) throw fail('Cannot replace a room containing allocated bottles', 409, "api.errors.roomTransferOccupiedRoom");
  for (const room of plan.toReplace) {
    const index = data.rooms.findIndex(existing => existing.id === room.id);
    if (index < 0) throw fail('Room changed during import', 409, "api.errors.roomTransferRoomChanged");
    data.rooms[index] = room;
  }
  data.rooms.push(...plan.toAdd);
  for (const [bottleId, shelfId] of plan.transfers) data.assignments[bottleId] = shelfId;
  return plan.summary;
});
