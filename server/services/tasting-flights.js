/** Tasting Flights: one ordered grouping per independently stored tasting. */
import {read,change} from '../storage/collection-store.js';
import {now,uid} from '../domain/collection.js';
import {fail} from '../domain/errors.js';
import {normalizeFlightFields,FLIGHT_LIMIT,allTastingReferences,flightEntries} from '../../shared/tasting-flights.js';
import {normalizeTastingRecord} from '../../shared/tasting-records.js';
import {normalizeStandaloneTasting} from '../../shared/standalone-tastings.js';

const find=(collection,id)=>{
    const flight=(collection.tastingFlights || []).find(f=>f.id===id);
    if (!flight) throw fail('Tasting-Flight nicht gefunden',404);
    return flight;
};
const normalize=(body,old)=>{
    try {return normalizeFlightFields(body,old);}
    catch(error){throw fail(error.message,400);}
};
export function list() {return read().tastingFlights || [];}
export function get(id) {return find(read(),id);}
export function create(body) {
    return change(collection=>{
        const when=now();
        const flight={id:uid(),...normalize(body),tastingIds:[],createdAt:when,updatedAt:when};
        (collection.tastingFlights ||= []).push(flight);
        return flight;
    });
}
export function update(id,body) {
    return change(collection=>{
        const flight=find(collection,id);
        Object.assign(flight,normalize(body,flight),{updatedAt:now()});
        return flight;
    });
}
export function remove(id) {
    return change(collection=>{
        const flight=find(collection,id);
        collection.tastingFlights.splice(collection.tastingFlights.indexOf(flight),1);
        return {ok:true}; // Never delete tasting records.
    });
}
function assertAvailable(collection,flight,ids) {
    if (!Array.isArray(ids) || ids.length>FLIGHT_LIMIT ||
        ids.some(id=>typeof id!=='string' || !/^[a-zA-Z0-9-]{1,100}$/.test(id)) ||
        new Set(ids).size!==ids.length) throw fail('Ungültige Flight-Reihenfolge',400);
    const refs=allTastingReferences(collection);
    for (const id of ids) {
        if (refs.filter(item=>item.record.id===id).length!==1) throw fail('Verkostung nicht gefunden oder nicht eindeutig',400);
        if ((collection.tastingFlights || []).some(other=>other.id!==flight.id && other.tastingIds.includes(id)))
            throw fail('Verkostung gehört bereits zu einem anderen Flight',409);
    }
}
export function setTastings(id,body) {
    if (!body || typeof body!=='object' || Array.isArray(body) ||
        Object.keys(body).length!==1 || !Object.hasOwn(body,'tastingIds')) throw fail('Ungültige Flight-Reihenfolge',400);
    return change(collection=>{
        const flight=find(collection,id);
        assertAvailable(collection,flight,body.tastingIds);
        flight.tastingIds=[...body.tastingIds];
        flight.updatedAt=now();
        return flight;
    });
}
/** Create a single tasting in a flight in one atomic write (also for unowned whiskies). */
export function createTasting(id,body) {
    if (!body || typeof body!=='object' || Array.isArray(body)) throw fail('Ungültige Verkostungsdaten',400);
    return change(collection=>{
        const flight=find(collection,id);
        if (flight.tastingIds.length>=FLIGHT_LIMIT) throw fail('Flight enthält zu viele Verkostungen',400);
        const {bottlingId,bottling,...data}=body;
        if ((bottlingId == null)===(bottling == null)) throw fail('Abfüllung muss eindeutig gewählt werden',400);
        let normalized,owned;
        try {
            if (bottlingId!=null) {
                if (typeof bottlingId!=='string') throw new Error('Ungültige Abfüllung');
                owned=collection.bottlings.find(b=>b.id===bottlingId);
                if (!owned) throw fail('Abfüllung nicht gefunden',404);
                normalized=normalizeTastingRecord(data);
            } else normalized=normalizeStandaloneTasting({...data,bottling});
        } catch(error) {if (error.status) throw error;throw fail(error.message,400);}
        const timestamp=now();
        const record={...normalized,id:uid(),createdAt:timestamp,updatedAt:timestamp};
        if (owned) {
            (owned.tastings ||= []).push(record);

            owned.updatedAt=timestamp;
        } else (collection.externalTastings ||= []).push(record);
        flight.tastingIds.push(record.id);
        flight.updatedAt=timestamp;
        return {record,bottlingId:owned?.id || null};
    });
}
