/** Physical storage locations and individual bottle allocations. No collection mutations. */
import crypto from 'node:crypto';
import { read } from '../storage/collection-store.js';
import { readWarehouse, changeWarehouse } from '../storage/warehouse-store.js';
import { fail } from '../domain/errors.js';
import { furnitureBounds, furnitureCollision, furnitureOverlap } from '../../public/js/domain/warehouse-placement.js';
import { name, number, capacity, shelfFront, doorLeaves, glassFrame, doorRanges, shelfHeight, ensureShelfHeights, layout } from '../domain/warehouse-fields.js';

const newId = () => crypto.randomUUID();

function roomById(data, id) {
    const room = data.rooms.find(entry => entry.id === id);
    if (!room) throw fail('Raum nicht gefunden', 404);
    return room;
}
function furnishingById(data, id) {
    for (const room of data.rooms) {
        const furniture = room.furniture.find(item => item.id === id);
        if (furniture) return { room, furniture };
    }
    throw fail('Lagermöbel nicht gefunden', 404);
}
function shelfById(data, id) {
    for (const room of data.rooms) for (const furniture of room.furniture) {
        const shelf = furniture.shelves.find(item => item.id === id);
        if (shelf) return { room, furniture, shelf };
    }
    throw fail('Fach nicht gefunden', 404);
}
function refuseOccupied(data, shelfIds) {
    // Deleting a physical bottle only changes collection.json. Old warehouse
    // references must not permanently block a now-empty room or shelf.
    const liveIds = new Set(physicalBottles().map(bottle => bottle.id));
    for (const id of Object.keys(data.assignments)) if (!liveIds.has(id)) delete data.assignments[id];
    if (Object.values(data.assignments).some(id => shelfIds.has(id))) throw fail('Lagerort enthält Flaschen. Bitte zuerst umlagern.', 409);
}
function physicalBottles() {
    return read().bottlings.flatMap(bottling => bottling.bottles.map(bottle => ({
        id: bottle.id, bottlingId: bottling.id, name: bottling.name,
        number: bottle.inventoryNumber || '', volumeType: bottle.volumeType || 'standard', status: bottle.status,
        volumeMl: bottle.volumeMl ?? bottling.volumeMl ?? null,
        photoPath: (() => { const photo = bottle.photos?.find(entry => typeof entry?.path === 'string' && entry.path); return photo?.cutout?.selected ? photo.cutout.path : (photo?.path || null); })()
    })));
}
export function getWarehouse() {
    const data = readWarehouse();
    const bottles = physicalBottles();
    const known = new Set(bottles.map(b => b.id));
    const assignments = Object.fromEntries(Object.entries(data.assignments).filter(([id]) => known.has(id)));
    return { schemaVersion: data.schemaVersion, rooms: data.rooms, assignments, bottles,
        // References to removed collection bottles remain distinguishable until cleaned.
        staleAssignments: Object.keys(data.assignments).filter(id => !known.has(id)).length };
}
export const createRoom = input => changeWarehouse(data => {
    const item = { id: newId(), name: name(input?.name), width: number(input?.width ?? 4, 'Raumbreite', 1, 100), height: number(input?.height ?? 4, 'Raumtiefe', 1, 100), furniture: [] };
    data.rooms.push(item); return item;
});
export const updateRoom = (id, input) => changeWarehouse(data => {
    const room = roomById(data, id);
    const next = { ...room, name: name(input?.name), width: number(input?.width, 'Raumbreite', 1, 100), height: number(input?.height, 'Raumtiefe', 1, 100) };
    for (const furniture of room.furniture) layout({ ...furniture }, next);
    Object.assign(room, next); return room;
});
export const deleteRoom = id => changeWarehouse(data => {
    const room = roomById(data, id);
    refuseOccupied(data, new Set(room.furniture.flatMap(f => f.shelves.map(s => s.id))));
    data.rooms.splice(data.rooms.indexOf(room), 1); return { ok: true };
});
export const createFurniture = (roomId, input) => changeWarehouse(data => {
    const room = roomById(data, roomId);
    const item = { id: newId(), ...layout(input || {}, room), shelves: [] };
    ensureNoFurnitureCollision(room, item);
    room.furniture.push(item); return item;
});
export const updateFurniture = (id, input) => changeWarehouse(data => {
    const { room, furniture } = furnishingById(data, id);
    const next = layout({...input, shelves:furniture.shelves}, room);
    ensureShelfHeights(furniture, furniture.shelves, next.itemHeight);
    // Existing installations may contain furniture that was positioned before
    // collision checking existed. Do not block harmless metadata edits; only
    // enforce the new rule when the occupied volume actually changes.
    const oldBounds = furnitureBounds(furniture), newBounds = furnitureBounds(next);
    if (['x','y','w','h','z','d'].some(key => Math.abs(oldBounds[key] - newBounds[key]) > 0.00001))
        ensureNoFurnitureCollision(room, {...next, id:furniture.id});
    Object.assign(furniture, next); return furniture;
});
/** Apply the same explicitly selected properties to many furniture items atomically.
 * Each resulting layout is checked before any in-memory item is changed;
 * changeWarehouse persists exactly once only after a successful mutation.
 */
export const bulkUpdateFurniture = input => changeWarehouse(data => {
    const ids = input?.ids;
    const changes = input?.changes;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 200 ||
        !ids.every(id => typeof id === 'string' && id.length > 0) || new Set(ids).size !== ids.length) {
        throw fail('Bitte 1 bis 200 unterschiedliche Lagermöbel auswählen');
    }
    const allowed = new Set(['rotation', 'elevation', 'itemHeight', 'width', 'depth', 'leftSidePanel', 'rightSidePanel', 'backPanel', 'doorLeaves', 'glassFrame']);
    if (!changes || typeof changes !== 'object' || Array.isArray(changes) ||
        !Object.keys(changes).length || Object.keys(changes).some(key => !allowed.has(key))) {
        throw fail('Keine gültigen gemeinsamen Eigenschaften angegeben');
    }
    const updates = ids.map(id => {
        const {room, furniture} = furnishingById(data, id);
        const next = layout({...furniture, ...changes, shelves:furniture.shelves}, room);
        ensureShelfHeights(furniture, furniture.shelves, next.itemHeight);
        return {furniture, next};
    });
    if (['rotation','elevation','itemHeight','width','depth'].some(key => Object.hasOwn(changes, key))) {
        // Evaluate the FINAL state, including collisions between simultaneously changed items.
        const proposed = new Map(updates.map(({furniture,next}) => [furniture.id, {...next,id:furniture.id}]));
        for (const {furniture,next} of updates) {
            const {room} = furnishingById(data, furniture.id);
            ensureNoFurnitureCollision(room, {...next,id:furniture.id}, room.furniture.map(item => proposed.get(item.id) || item));
        }
    }
    for (const {furniture, next} of updates) Object.assign(furniture, next);
    return {updated: updates.map(({furniture}) => furniture.id), count: updates.length};
});

/** Atomic multi-delete. Verify every selected location before removing anything. */
export const bulkDeleteFurniture = input => changeWarehouse(data => {
    const ids = input?.ids;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 200 ||
        !ids.every(id => typeof id === 'string' && id.length > 0) || new Set(ids).size !== ids.length)
        throw fail('Bitte 1 bis 200 unterschiedliche Lagermöbel auswählen');
    const targets = ids.map(id => furnishingById(data, id));
    refuseOccupied(data, new Set(targets.flatMap(({furniture}) => furniture.shelves.map(shelf => shelf.id))));
    for (const {room, furniture} of targets) room.furniture.splice(room.furniture.indexOf(furniture), 1);
    return {ok:true, deleted:ids, count:ids.length};
});

export const deleteFurniture = id => changeWarehouse(data => {
    const { room, furniture } = furnishingById(data, id);
    refuseOccupied(data, new Set(furniture.shelves.map(s => s.id)));
    room.furniture.splice(room.furniture.indexOf(furniture), 1); return { ok: true };
});
export const createShelf = (furnitureId, input) => changeWarehouse(data => {
    const { furniture } = furnishingById(data, furnitureId);
    const item = { id: newId(), name: name(input?.name), capacity: capacity(input?.capacity),
        front: shelfFront(input?.front), heightCm: shelfHeight(input?.heightCm),
        doorLeaves: doorLeaves(input?.doorLeaves), glassFrame: glassFrame(input?.glassFrame) };
    ensureShelfHeights(furniture, [...furniture.shelves, item]);
    furniture.shelves.push(item); return item;
});
export const updateShelf = (id, input) => changeWarehouse(data => {
    const { furniture, shelf } = shelfById(data, id);
    const next = {...shelf, name: name(input?.name), front: shelfFront(input?.front), heightCm: shelfHeight(input?.heightCm),
        doorLeaves: doorLeaves(input?.doorLeaves), glassFrame: glassFrame(input?.glassFrame)};
    ensureShelfHeights(furniture, furniture.shelves.map(item => item.id === id ? next : item));
    const nextCapacity = capacity(input?.capacity);
    if (nextCapacity !== null) {
        const known = new Set(physicalBottles().map(b => b.id));
        const occupied = Object.entries(data.assignments).filter(([bid, sid]) => sid === id && known.has(bid)).length;
        if (occupied > nextCapacity) throw fail('Kapazität liegt unter der aktuellen Belegung', 409);
    }
    Object.assign(shelf, next, {capacity:nextCapacity});
    return shelf;
});
export const deleteShelf = id => changeWarehouse(data => {
    const { furniture, shelf } = shelfById(data, id);
    refuseOccupied(data, new Set([id]));
    const removed = furniture.shelves.indexOf(shelf) + 1;
    furniture.shelves.splice(removed - 1, 1);
    furniture.doorRanges = (furniture.doorRanges || []).flatMap(range => {
        if (removed < range.from) return [{...range,from:range.from-1,to:range.to-1}];
        if (removed > range.to) return [range];
        return range.from === range.to ? [] : [{...range,to:range.to-1}];
    });
    return { ok: true };
});
/** Change only the vertical order of existing shelf IDs, never assignments. */
export const moveShelf = (id, input) => changeWarehouse(data => {
    const {furniture,shelf} = shelfById(data,id);
    if (!['up','down'].includes(input?.direction)) throw fail('Ungültige Verschieberichtung');
    const index=furniture.shelves.indexOf(shelf);
    const next=index + (input.direction === 'up' ? 1 : -1);
    if (next<0 || next>=furniture.shelves.length) throw fail('Fach ist bereits am Rand',409);
    [furniture.shelves[index],furniture.shelves[next]]=[furniture.shelves[next],furniture.shelves[index]];
    return {id,position:next};
});
/** Copies are new locations, never new assignments to existing physical bottles. */
function copiedName(source, siblings) {
    const names = new Set(siblings.map(item => item.name));
    for (let n = 1; n <= 10000; n++) {
        const suffix = n === 1 ? ' (Kopie)' : ` (Kopie ${n})`;
        const candidate = `${source.slice(0, 100 - suffix.length)}${suffix}`;
        if (!names.has(candidate)) return candidate;
    }
    throw fail('Kein freier Kopiename verfügbar', 409);
}
function ensureNoFurnitureCollision(room, item, others = room.furniture) {
    const conflict = furnitureCollision(room, item, others);
    if (conflict) throw fail(`Lagermöbel überschneidet sich mit „${conflict.name}“ (Grundfläche und Höhenbereich)`, 409);
}
/** Find a non-overlapping, in-bounds position for the copied furniture.
 * Existing coordinates remain unchanged. Furniture may have been positioned by hand.
 */
function copyPosition(room, template) {
    const r = furnitureBounds(template);
    if (r.w > room.width || r.h > room.height) throw fail('Die Kopie passt nicht in den Zielraum', 409);
    const round = v => Math.round(v * 100) / 100;
    const xs = new Set([0, round(room.width - r.w), round(template.x), round(template.x + r.w + 0.1)]);
    const ys = new Set([0, round(room.height - r.h), round(template.y), round(template.y + r.h + 0.1)]);
    for (const item of room.furniture) {
        const other = furnitureBounds(item);
        xs.add(round(other.x + other.w));
        ys.add(round(other.y + other.h));
    }
    const positions = [...xs].flatMap(x => [...ys].map(y => ({x, y})))
        .filter(({x,y}) => x >= 0 && y >= 0 && x + r.w <= room.width + 0.00001 && y + r.h <= room.height + 0.00001)
        .sort((a,b) => (Math.abs(a.x - template.x) + Math.abs(a.y - template.y)) - (Math.abs(b.x - template.x) + Math.abs(b.y - template.y)) || a.y - b.y || a.x - b.x);
    for (const p of positions) {
        if (room.furniture.every(item => {
            return !furnitureOverlap({...template,...p}, item);
        })) return p;
    }
    throw fail('Kein freier Platz für die Kopie. Bitte zuerst Platz im Zielraum schaffen.', 409);
}
export const copyFurniture = (id, input = {}) => changeWarehouse(data => {
    const source = furnishingById(data, id);
    const targetRoom = input.roomId === undefined ? source.room : roomById(data, input.roomId);
    if (input.withShelves !== undefined && typeof input.withShelves !== 'boolean') throw fail('Ungültige Kopieroption');
    const withShelves = input.withShelves !== false;
    const position = copyPosition(targetRoom, source.furniture);
    const item = {
        id: newId(),
        ...layout({ ...source.furniture, ...position,
            name: input.name === undefined ? copiedName(source.furniture.name, targetRoom.furniture) : name(input.name) }, targetRoom),
        shelves: withShelves ? source.furniture.shelves.map(shelf => ({...shelf, id:newId()})) : [],
        doorRanges: withShelves ? (source.furniture.doorRanges || []).map(range=>({...range})) : []
    };
    targetRoom.furniture.push(item);
    return item;
});
export const copyShelf = (id, input = {}) => changeWarehouse(data => {
    const source = shelfById(data, id);
    const target = input.furnitureId === undefined ? source.furniture : furnishingById(data, input.furnitureId).furniture;
    const item = {id:newId(),
        name: input.name === undefined ? copiedName(source.shelf.name, target.shelves) : name(input.name),
        capacity: source.shelf.capacity, front:source.shelf.front ?? null, heightCm:source.shelf.heightCm ?? null,
        doorLeaves: source.shelf.doorLeaves ?? null, glassFrame: source.shelf.glassFrame ?? null};
    ensureShelfHeights(target, [...target.shelves, item]);
    target.shelves.push(item);
    return item;
});

export const assignBottle = (bottleId, input) => changeWarehouse(data => {
    const known = new Set(physicalBottles().map(item => item.id));
    if (!known.has(bottleId)) throw fail('Physische Flasche nicht gefunden', 404);
    const id = input?.shelfId;
    if (id === null || id === '' || id === undefined) {
        delete data.assignments[bottleId]; return { bottleId, shelfId: null };
    }
    if (typeof id !== 'string') throw fail('Ungültige Fach-ID');
    const { shelf } = shelfById(data, id);
    if (shelf.capacity !== null) {
        const used = Object.entries(data.assignments).filter(([bid, sid]) => bid !== bottleId && sid === id && known.has(bid)).length;
        if (used >= shelf.capacity) throw fail('Dieses Fach ist voll belegt', 409);
    }
    data.assignments[bottleId] = id;
    // Removing stale references is safe: absent bottles can no longer be reassigned.
    for (const bid of Object.keys(data.assignments)) if (!known.has(bid)) delete data.assignments[bid];
    return { bottleId, shelfId: id };
});
