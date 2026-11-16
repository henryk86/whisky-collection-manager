import { read, change } from '../storage/collection-store.js';
import { now, uid } from '../domain/collection.js';
import { fail } from '../domain/errors.js';
import {detachTastings} from '../../public/js/domain/tasting-flights.js';
import { normalizeTastingRecord, sortedTastings, syncTastingSummary } from '../../public/js/domain/tasting-records.js';
function requireBottling(collection, id) {
    const bottling = collection.bottlings.find(b => b.id === id);
    if (!bottling) throw fail('Abfüllung nicht gefunden',404);
    return bottling;
}
function requireTasting(bottling, tastingId) {
    const tasting = (bottling.tastings || []).find(entry => entry.id === tastingId);
    if (!tasting) throw fail('Verkostung nicht gefunden',404);
    return tasting;
}
function clean(input, old) {
    try { return normalizeTastingRecord(input, old); }
    catch (error) { throw fail(error.message,400); }
}
export function listTastings(id) { return sortedTastings(requireBottling(read(),id)); }
export function getTasting(id,tastingId) { return requireTasting(requireBottling(read(),id),tastingId); }
export function createTasting(id,input) {
    return change(collection => {
        const bottling = requireBottling(collection,id);
        const timestamp=now();
        const tasting={...clean(input),id:uid(),createdAt:timestamp,updatedAt:timestamp};
        if (!Array.isArray(bottling.tastings)) bottling.tastings=[];
        bottling.tastings.push(tasting);
        syncTastingSummary(bottling);
        bottling.updatedAt=timestamp;
        return tasting;
    });
}
export function updateTasting(id,tastingId,input) {
    return change(collection => {
        const bottling=requireBottling(collection,id);
        const tasting=requireTasting(bottling,tastingId);
        const updated=clean(input,tasting);
        Object.assign(tasting,updated,{updatedAt:now()});
        syncTastingSummary(bottling);
        bottling.updatedAt=tasting.updatedAt;
        return tasting;
    });
}
export function deleteTasting(id,tastingId) {
    return change(collection => {
        const bottling=requireBottling(collection,id);
        const index=(bottling.tastings || []).findIndex(entry=>entry.id===tastingId);
        if (index < 0) throw fail('Verkostung nicht gefunden',404);
        bottling.tastings.splice(index,1);
        detachTastings(collection,[tastingId]);
        syncTastingSummary(bottling);
        bottling.updatedAt=now();
        return {ok:true};
    });
}
