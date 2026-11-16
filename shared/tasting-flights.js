/** Optional tasting session: ordered references, never copies of scores or notes. */
import {validTastingDate} from './tasting-records.js';

export const FLIGHT_LIMIT = 100;
export function normalizeFlightFields(input, previous = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        Object.keys(input).some(key=>!['name','date','notes'].includes(key)))
        throw new Error('Ungültige Flight-Daten');
    const value={name:'',date:'',notes:'',...previous,...input};
    if (typeof value.name!=='string' || !value.name.trim() || value.name.length>160)
        throw new Error('Ungültiger Flight-Name');
    if (!validTastingDate(value.date)) throw new Error('Ungültiges Flight-Datum');
    if (typeof value.notes!=='string' || value.notes.length>10000)
        throw new Error('Ungültige Flight-Notiz');
    return {name:value.name.trim(),date:value.date,notes:value.notes};
}

export function allTastingReferences(collection) {
    return [
        ...(collection.bottlings || []).flatMap(b => (b.tastings || []).map(record=>({record,bottling:b,external:false}))),
        ...(collection.externalTastings || []).map(record=>({record,bottling:record.bottling,external:true}))
    ];
}

export function flightEntries(collection, flight) {
    const refs=allTastingReferences(collection);
    return (flight?.tastingIds || []).map(id=>refs.find(ref=>ref.record.id===id)).filter(Boolean);
}

export function flightForTasting(collection, tastingId) {
    return (collection?.tastingFlights || []).find(flight=>flight.tastingIds.includes(tastingId)) || null;
}

/** Remove references after deleting a tasting/bottling, without deleting the flight. */
export function detachTastings(collection, ids) {
    const deleted=new Set(ids);
    if (!deleted.size) return;
    for (const flight of collection.tastingFlights || []) {
        if (flight.tastingIds.some(id=>deleted.has(id))) {
            flight.tastingIds=flight.tastingIds.filter(id=>!deleted.has(id));
            flight.updatedAt=new Date().toISOString();
        }
    }
}
