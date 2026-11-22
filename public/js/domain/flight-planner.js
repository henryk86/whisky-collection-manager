/** Deterministic and offline-only suggestions for physical bottles. */
import {FLAVOR_AXES} from '../../../shared/flavor-profile.js';
import {latestTasting,sortedTastings} from '../../../shared/tasting-records.js';

export const FLIGHT_STYLES = Object.freeze(['balanced','similar','contrast','discover']);
export const FLIGHT_AVAILABILITY = Object.freeze(['open','all','samples']);
export function flightCandidates(collection, {availability='open', bottlingIds=null}={}) {
    const whitelist = Array.isArray(bottlingIds) ? new Set(bottlingIds) : null;
    return (collection.bottlings || []).flatMap(bottling => {
        if (whitelist && !whitelist.has(bottling.id)) return [];
        const bottles = (bottling.bottles || []).filter(b => b.status !== 'empty' &&
            (availability !== 'open' || b.status === 'open') &&
            (availability !== 'samples' || b.volumeType === 'sample'));
        if (!bottles.length) return [];
        // Open bottles first, then samples. Never suggest multiple physical bottles of one bottling.
        bottles.sort((a,b) => Number(b.status==='open')-Number(a.status==='open') ||
            Number(b.volumeType==='sample')-Number(a.volumeType==='sample') || a.id.localeCompare(b.id));
        const latest = latestTasting(bottling);
        const profile = sortedTastings(bottling).find(item=>item.flavorProfile)?.flavorProfile || null;
        const assessed = FLAVOR_AXES.filter(axis=>Number.isFinite(profile?.[axis]));
        const intensity = assessed.length ? assessed.reduce((sum,axis)=>sum+profile[axis],0)/assessed.length : 0;
        return [{bottling,bottle:bottles[0],profile,assessed,intensity,
            lastTasted:latest?.tastedOn || '', rating:latest?.rating ?? null}];
    });
}
function distance(left,right) {
    const comparable=FLAVOR_AXES.filter(key=>Number.isFinite(left.profile?.[key]) && Number.isFinite(right.profile?.[key]));
    return comparable.length ? comparable.reduce((sum,key)=>sum+Math.abs(left.profile[key]-right.profile[key]),0)/comparable.length : null;
}
function novelty(item) {
    return (item.lastTasted ? 0 : 30) + (item.assessed.length ? 0 : 4) +
        (item.bottle.status==='open' ? 3 : 0) + (item.lastTasted ? Math.min(10,Math.max(0,(Date.now()-Date.parse(item.lastTasted))/86400000/30)) : 0);
}
function intensity(item) {
    return (Number(item.bottling.abv) || 40)/12 + item.intensity +
        (Number(item.profile?.smoky) || 0)/4 + (Number(item.profile?.peaty) || 0)/4;
}
/** Stable proposals and human-readable, evidence-based reasons; no guessed flavors. */
export function suggestFlight(collection,{style='balanced',count=5,availability='open',bottlingIds=null}={}) {
    if (!FLIGHT_STYLES.includes(style) || !FLIGHT_AVAILABILITY.includes(availability) ||
        !Number.isInteger(count) || count < 1 || count > 6) throw new Error('Invalid flight request');
    const candidates=flightCandidates(collection,{availability,bottlingIds});
    const picked=[];
    while (picked.length < count && picked.length < candidates.length) {
        const available=candidates.filter(item=>!picked.includes(item));
        available.sort((a,b)=>{
            const metric=item=>{
                const ids=new Set(item.bottling.distilleryIds || (item.bottling.distilleryId?[item.bottling.distilleryId]:[]));
                const repeated=ids.size && picked.some(other=>(other.bottling.distilleryIds ||
                    (other.bottling.distilleryId?[other.bottling.distilleryId]:[])).some(id=>ids.has(id)));
                const diversity= repeated ? 2 : 0;
                if (style==='discover') return novelty(item)-diversity;
                if (style==='balanced') return (item.assessed.length ? 10 : 0) + novelty(item)/8-diversity;
                if (!picked.length) return (item.assessed.length ? 20 : 0) + novelty(item)/8;
                const distances=picked.map(other=>distance(item,other)).filter(x=>x!==null);
                if (!distances.length) return -50;
                const avg=distances.reduce((s,x)=>s+x,0)/distances.length;
                return (style==='similar' ? -avg : avg)-diversity;
            };
            return metric(b)-metric(a) || a.bottling.name.localeCompare(b.bottling.name,'de') || a.bottle.id.localeCompare(b.bottle.id);
        });
        picked.push(available[0]);
    }
    // For a flight tasting sequence, deliberately move from softer to stronger.
    picked.sort((a,b)=>intensity(a)-intensity(b) || a.bottling.name.localeCompare(b.bottling.name,'de'));
    return picked.map(item=>({bottlingId:item.bottling.id,bottleId:item.bottle.id,
        reason:!item.assessed.length ? 'noProfile' : style==='discover' && !item.lastTasted ? 'untried'
            : style==='contrast' ? 'contrast' : style==='similar' ? 'similar' : 'intensity'}));
}
