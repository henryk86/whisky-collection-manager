/** Per-request mutation data. AsyncLocalStorage prevents concurrent requests
 * from mixing patches and never exposes another client's collection. */
import { AsyncLocalStorage } from 'node:async_hooks';
import { resourceDelta } from '../../shared/resource-delta.js';
const storage = new AsyncLocalStorage();
export async function withMutationTracking(task) {
    const updates = [];
    const value = await storage.run(updates, task);
    return {value, updates};
}
export function trackMutation(kind, previous, current, previousEtag, nextEtag) {
    const updates = storage.getStore();
    if (updates) updates.push({before: previousEtag, after: nextEtag,
        delta: resourceDelta(kind, previous, current)});
}
