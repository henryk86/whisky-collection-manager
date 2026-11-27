/** Per-request mutation data. AsyncLocalStorage prevents concurrent requests
 * from mixing patches and never exposes another client's collection. */
import {AsyncLocalStorage} from 'node:async_hooks';
import {resourceDelta} from '../../shared/resource-delta.js';
import {collectionMetadata} from './bottling-metadata.js';
const storage = new AsyncLocalStorage();
/**
 * Runs a collection mutation while tracking affected resources.
 *
 * @param {*} task Operation executed with an isolated asynchronous mutation log.
 * @return {!Promise<!Object>} Task result and the resource updates recorded during its execution.
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
 * @param {*} previous Resource snapshot before the mutation.
 * @param {*} current Current resource data to update.
 * @param {string} previousEtag Entity tag identifying the previous resource version.
 * @param {string} nextEtag Entity tag identifying the updated resource version.
 */
export function trackMutation(kind, previous, current, previousEtag, nextEtag) {
  const updates = storage.getStore();
  if (updates) updates.push({
    before: previousEtag, after: nextEtag,
    delta: kind === 'collection' ? resourceDelta(kind, collectionMetadata(previous), collectionMetadata(current)) : resourceDelta(kind, previous, current),
  });
}
