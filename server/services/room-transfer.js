/** Portable room layout transfer. Never imports collection records or photos.
 * All imports are planned against current data and committed in one warehouse write.
 */
import crypto from 'node:crypto';
import { validateWarehouse } from '../storage/warehouse-store.js';
import { fail } from '../domain/errors.js';

const FORMAT = 'wcm-room-transfer';
const VERSION = 1;
const id = () => crypto.randomUUID();
const furnitureKeys = ['name','type','x','y','width','depth','rotation','elevation','itemHeight','leftSidePanel','rightSidePanel','backPanel','doorLeaves','glassFrame'];
const shelfKeys = ['name','capacity','front','heightCm','doorLeaves','glassFrame'];
const pick = (source, keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(source,key)).map(key=>[key,source[key]]));
const key = value => String(value || '').trim().toLocaleLowerCase('de');
const sourceId = room => room.transferSourceId || room.id;

function assertIds(ids, allIds) {
    if (ids === 'all') return allIds;
    if (!Array.isArray(ids) || !ids.length || ids.length > 200 || !ids.every(item => typeof item === 'string') || new Set(ids).size !== ids.length || ids.some(item => !allIds.includes(item))) {
        throw fail('Invalid room selection', 400, "api.errors.roomTransferInvalidRoomSelection");
    }
    return ids;
}

/** Store portable properties only, not server-side collection metadata. */
function exportLayout(room) {
    return {
        id: sourceId(room), name: room.name, width: room.width, height: room.height,
        furniture: room.furniture.map(f => ({id:f.id,...pick(f, furnitureKeys),
            doorRanges:(f.doorRanges || []).map(range=>pick(range,['from','to','front','doorLeaves','glassFrame'])),
            shelves:f.shelves.map(s=>({id:s.id,...pick(s,shelfKeys)}))}))
    };
}

export function createRoomExport(warehouse, ids, includeAssignments = false) {
    if (typeof includeAssignments !== 'boolean') throw fail('Invalid assignment option', 400, "api.errors.roomTransferInvalidAssignmentOption");
    const selected = new Set(assertIds(ids,warehouse.rooms.map(room=>room.id)));
    const rooms = warehouse.rooms.filter(room=>selected.has(room.id)).map(exportLayout);
    const shelfIds = new Set(warehouse.rooms.filter(room=>selected.has(room.id)).flatMap(room=>room.furniture.flatMap(f=>f.shelves.map(s=>s.id))));
    const bottles = new Map((warehouse.bottles || []).map(b=>[b.id,b]));
    const assignments = includeAssignments ? Object.entries(warehouse.assignments || {}).filter(([bottleId,shelfId]) => shelfIds.has(shelfId) && bottles.has(bottleId))
        .map(([bottleId,shelfId])=>({bottleId,shelfId,inventoryNumber:bottles.get(bottleId).number || null})) : [];
    return {format:FORMAT,formatVersion:VERSION,exportedAt:new Date().toISOString(),includesAssignments:includeAssignments,rooms,assignments};
}

function validateBundle(bundle) {
    if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle) || bundle.format !== FORMAT || bundle.formatVersion !== VERSION ||
        !Array.isArray(bundle.rooms) || !bundle.rooms.length || bundle.rooms.length > 200 || !Array.isArray(bundle.assignments) || bundle.assignments.length > 100000 ||
        typeof bundle.includesAssignments !== 'boolean') throw fail('Invalid or unsupported room transfer file', 400, "api.errors.roomTransferInvalidFile");
    const json = JSON.stringify(bundle);
    if (json.length > 12 * 1024 * 1024) throw fail('Room transfer file is too large', 413, "api.errors.roomTransferTooLarge");
    if (bundle.rooms.reduce((sum,r)=>sum+(r.furniture?.length||0),0)>5000 || bundle.rooms.reduce((sum,r)=>sum+(r.furniture||[]).reduce((n,f)=>n+(f.shelves?.length||0),0),0)>20000) throw fail('Room transfer file exceeds the supported size', 413, "api.errors.roomTransferTooManyItems");
    // Validation also checks unique IDs, dimensions, furniture boundaries, shelves, doors, etc.
    validateWarehouse({schemaVersion:1,rooms:bundle.rooms,assignments:{}});
    const shelves = new Set(bundle.rooms.flatMap(r=>r.furniture.flatMap(f=>f.shelves.map(s=>s.id))));
    const seen = new Set();
    for (const item of bundle.assignments) {
        if (!item || typeof item !== 'object' || typeof item.bottleId !== 'string' || item.bottleId.length > 120 ||
            !shelves.has(item.shelfId) || (item.inventoryNumber != null && (typeof item.inventoryNumber !== 'string' || item.inventoryNumber.length > 120)) ||
            seen.has(item.bottleId)) throw fail('Invalid bottle reference in room transfer file', 400, "api.errors.roomTransferInvalidBottle");
        seen.add(item.bottleId);
    }
    return bundle;
}

/** Dry run and real import use this same calculation, avoiding divergent rules. */
export function planRoomImport(warehouse, rawBundle, {includeAssignments = true, conflictPolicy = 'skip'} = {}) {
    const bundle = validateBundle(rawBundle);
    if (typeof includeAssignments !== 'boolean' || !['skip','replace'].includes(conflictPolicy)) throw fail('Invalid room import options', 400, "api.errors.roomTransferInvalidOptions");
    const existing = warehouse.rooms || [];
    const roomActions = [];
    const plannedNames = new Set(existing.map(r=>key(r.name)));
    const destinationIds = new Set(existing.flatMap(room=>[room.id,...room.furniture.flatMap(f=>[f.id,...f.shelves.map(s=>s.id)])]));
    const remap = new Map();
    let skippedRooms=0, replacedRooms=0, blockedRooms=0;
    const toAdd = [], toReplace = [];
    for (const source of bundle.rooms) {
        const match = existing.find(room=> sourceId(room) === source.id || room.id === source.id) || existing.find(room=>key(room.name) === key(source.name));
        if (match && conflictPolicy === 'skip') {skippedRooms++;roomActions.push({name:source.name,action:'skip'});continue;}
        if (!match && plannedNames.has(key(source.name))) {skippedRooms++;roomActions.push({name:source.name,action:'skip'});continue;}
        if (match && Object.values(warehouse.assignments || {}).some(shelfId=>match.furniture.some(f=>f.shelves.some(s=>s.id===shelfId)))) {
            blockedRooms++;roomActions.push({name:source.name,action:'blocked'});continue;
        }
        const makeId=()=>{let fresh;do{fresh=id();}while(destinationIds.has(fresh));destinationIds.add(fresh);return fresh;};
        const target={ id:match ? match.id : makeId(), transferSourceId:source.id,
            name:source.name,width:source.width,height:source.height,
            furniture:source.furniture.map(f=>({id:makeId(),...pick(f,furnitureKeys),
                doorRanges:(f.doorRanges||[]).map(range=>pick(range,['from','to','front','doorLeaves','glassFrame'])),
                shelves:f.shelves.map(s=>{const newShelf={id:makeId(),...pick(s,shelfKeys)};remap.set(s.id,newShelf.id);return newShelf;})}))};
        if (match) {toReplace.push(target);replacedRooms++;roomActions.push({name:source.name,action:'replace'});}
        else {toAdd.push(target);plannedNames.add(key(source.name));roomActions.push({name:source.name,action:'add'});}
    }
    const matchingIds = new Map((warehouse.bottles || []).map(b=>[b.id,b]));
    const matchingInventory = new Map();
    for (const b of warehouse.bottles || []) if (key(b.number)) matchingInventory.set(key(b.number),[...(matchingInventory.get(key(b.number))||[]),b]);
    const transfers=[];
    const selectedBottles = new Set();
    const newOccupancy = new Map();
    const capacities = new Map([...toAdd,...toReplace].flatMap(r=>r.furniture.flatMap(f=>f.shelves.map(s=>[s.id,s.capacity]))));
    const assignmentStats={inFile:bundle.assignments.length,assigned:0,unmatched:0,ambiguous:0,alreadyAssigned:0,capacityExceeded:0,skippedRoom:0};
    if (includeAssignments && bundle.includesAssignments) for (const link of bundle.assignments) {
        const shelfId=remap.get(link.shelfId);
        if (!shelfId) {assignmentStats.skippedRoom++;continue;}
        let bottle=matchingIds.get(link.bottleId);
        if (!bottle && key(link.inventoryNumber)) {
            const matches=matchingInventory.get(key(link.inventoryNumber))||[];
            if(matches.length>1) {assignmentStats.ambiguous++;continue;}
            bottle=matches[0];
        }
        if(!bottle) {assignmentStats.unmatched++;continue;}
        if (selectedBottles.has(bottle.id) || warehouse.assignments?.[bottle.id]) {assignmentStats.alreadyAssigned++;continue;}
        const nextCount=(newOccupancy.get(shelfId)||0)+1;
        const limit=capacities.get(shelfId);
        if(limit!==null && nextCount>limit) {assignmentStats.capacityExceeded++;continue;}
        selectedBottles.add(bottle.id);newOccupancy.set(shelfId,nextCount);
        transfers.push([bottle.id,shelfId]);assignmentStats.assigned++;
    }
    return {
        summary:{roomsInFile:bundle.rooms.length,createdRooms:toAdd.length,replacedRooms,skippedRooms,blockedRooms,
            ...assignmentStats,roomActions,assignmentsRequested:includeAssignments&&bundle.includesAssignments},
        toAdd,toReplace,transfers
    };
}
