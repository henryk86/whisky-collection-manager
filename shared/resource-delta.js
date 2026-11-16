/** Immutable, ID-keyed state changes. Browser and server use the same contract.
 * A delta never edits a stored object or arbitrary prototype properties. */
const FIELDS = Object.freeze({
    collection: { values: ['schemaVersion', 'nextInventoryNumber', 'reservedInventoryNumbers', 'settings'],
        arrays: ['distilleries', 'bottlings', 'externalTastings', 'tastingFlights'] },
    warehouse: { values: ['schemaVersion', 'assignments'], arrays: ['rooms'] },
});
const identical = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function resourceDelta(kind, before, after) {
    const spec = FIELDS[kind];
    if (!spec) throw new Error(`Unknown resource: ${kind}`);
    const values = {};
    const arrays = {};
    for (const key of spec.values) if (!identical(before[key], after[key])) values[key] = structuredClone(after[key]);
    for (const key of spec.arrays) {
        const prev = before[key], next = after[key];
        if (!Array.isArray(prev) || !Array.isArray(next)) throw new Error(`Invalid resource array: ${key}`);
        const old = new Map(prev.map(record => [record.id, record]));
        const fresh = new Set(next.map(record => record.id));
        const remove = prev.filter(record => !fresh.has(record.id)).map(record => record.id);
        const upsert = next.filter(record => !old.has(record.id) || !identical(old.get(record.id), record));
        const orderChanged = prev.length !== next.length || prev.some((record, i) => record.id !== next[i].id);
        if (upsert.length || remove.length || orderChanged) {
            arrays[key] = {upsert: structuredClone(upsert), remove,
                ...(orderChanged ? {order: next.map(record => record.id)} : {})};
        }
    }
    return {kind, values, arrays};
}
export function applyResourceDelta(current, delta) {
    const spec = FIELDS[delta?.kind];
    if (!spec || !current || typeof current !== 'object') throw new Error('Invalid resource delta');
    const next = structuredClone(current);
    for (const [key, value] of Object.entries(delta.values || {})) {
        if (!spec.values.includes(key)) throw new Error(`Invalid resource property: ${key}`);
        next[key] = structuredClone(value);
    }
    for (const [key, change] of Object.entries(delta.arrays || {})) {
        if (!spec.arrays.includes(key) || !Array.isArray(change.upsert) || !Array.isArray(change.remove))
            throw new Error(`Invalid resource array patch: ${key}`);
        const ids = new Map(next[key].map(entry => [entry.id, entry]));
        for (const id of change.remove) ids.delete(id);
        for (const item of change.upsert) {
            if (typeof item?.id !== 'string' || !item.id) throw new Error('Invalid delta entity ID');
            ids.set(item.id, structuredClone(item));
        }
        if (change.order) {
            if (!Array.isArray(change.order) || change.order.length !== ids.size || new Set(change.order).size !== ids.size ||
                change.order.some(id => !ids.has(id))) throw new Error('Invalid delta entity order');
            next[key] = change.order.map(id => ids.get(id));
        } else {
            next[key] = [...ids.values()];
        }
    }
    return next;
}
