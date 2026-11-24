/** Per-request mutation data. AsyncLocalStorage prevents concurrent requests
 * from mixing patches and never exposes another client's collection. */
import {AsyncLocalStorage} from 'node:async_hooks';
import {resourceDelta} from '../../shared/resource-delta.js';
const storage = new AsyncLocalStorage();
/**
 * Runs a collection mutation while tracking affected resources.
 *
 * @param {*} task Task used by this operation.
 * @return {!Promise<!Object>} Promise fulfilled when the operation completes.
 */
export async function withMutationTracking(task) {
  const updates = [];
  const value = await storage.run(updates, task);
  return {value, updates};
}

/**
 * Records the domain resource modified by the current request.
 *
 * @param {string} kind Resource kind selecting the relevant schema.
 * @param {*} previous Previous used by this operation.
 * @param {*} current Current resource data to update.
 * @param {*} previousEtag Previous etag used by this operation.
 * @param {*} nextEtag Next etag used by this operation.
 */
export function trackMutation(kind, previous, current, previousEtag, nextEtag) {
  const updates = storage.getStore();
  if (updates) updates.push({
    before: previousEtag, after: nextEtag,
    delta: resourceDelta(kind, previous, current),
  });
}
