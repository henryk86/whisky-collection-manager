import {read, change} from '../storage/collection-store.js';
import {now, uid} from '../domain/collection.js';
import {fail} from '../domain/errors.js';
import {detachTastings} from '../../shared/tasting-flights.js';
import {normalizeTastingRecord, sortedTastings} from '../../shared/tasting-records.js';
/**
 * Enforces the bottling precondition.
 *
 * @param {*} collection Collection data to process.
 * @param {*} id Identifier of the affected record.
 * @return {*} Result computed from the supplied inputs.
 */
function requireBottling(collection, id) {
  const bottling = collection.bottlings.find(b => b.id === id);
  if (!bottling) throw fail('Abfüllung nicht gefunden', 404, "api.errors.bottlingNotFound");
  return bottling;
}

/**
 * Enforces the tasting precondition.
 *
 * @param {*} bottling Bottling record being inspected or updated.
 * @param {*} tastingId Value used by this operation.
 * @return {*} Result computed from the supplied inputs.
 */
function requireTasting(bottling, tastingId) {
  const tasting = (bottling.tastings || []).find(entry => entry.id ===
    tastingId);
  if (!tasting) throw fail('Verkostung nicht gefunden', 404, "api.errors.tastingNotFound");
  return tasting;
}

/**
 * Validates the clean state and rejects invalid inputs.
 *
 * @param {*} input Input element or value to inspect.
 * @param {*} old Value used by this operation.
 * @return {*} Value returned by the delegated operation.
 */
function clean(input, old) {
  try {return normalizeTastingRecord(input, old);}
  catch (error) {throw fail(error.message, 400, "api.errors.invalidTastingData");}
}

/**
 * Returns tastings associated with the requested collection scope.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @return {!Array<*>} Resulting list of values.
 */
export function listTastings(id) {return sortedTastings(requireBottling(read(), id));}

/**
 * Retrieves tasting for tastings.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @param {*} tastingId Tasting id used by this operation.
 * @return {*} Value returned by the delegated operation.
 */
export function getTasting(id, tastingId) {return requireTasting(requireBottling(read(), id), tastingId);}

/**
 * Creates tasting for tastings.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @param {*} input Input to process.
 * @return {!Promise<*>} Promise fulfilled when the operation completes.
 */
export function createTasting(id, input) {
  return change(collection => {
    const bottling = requireBottling(collection, id);
    const timestamp = now();
    const tasting = {...clean(input), id: uid(), createdAt: timestamp, updatedAt: timestamp};
    if (!Array.isArray(bottling.tastings)) bottling.tastings = [];
    bottling.tastings.push(tasting);

    bottling.updatedAt = timestamp;
    return tasting;
  });
}

/**
 * Updates tasting for tastings.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @param {*} tastingId Tasting id used by this operation.
 * @param {*} input Input to process.
 * @return {!Promise<*>} Promise fulfilled when the operation completes.
 */
export function updateTasting(id, tastingId, input) {
  return change(collection => {
    const bottling = requireBottling(collection, id);
    const tasting = requireTasting(bottling, tastingId);
    const updated = clean(input, tasting);
    Object.assign(tasting, updated, {updatedAt: now()});

    bottling.updatedAt = tasting.updatedAt;
    return tasting;
  });
}

/**
 * Clears tasting for tastings.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @param {*} tastingId Tasting id used by this operation.
 * @return {!Promise<!Object>} Promise fulfilled when the operation completes.
 */
export function deleteTasting(id, tastingId) {
  return change(collection => {
    const bottling = requireBottling(collection, id);
    const index = (bottling.tastings || []).findIndex(entry => entry.id ===
      tastingId);
    if (index < 0) throw fail('Verkostung nicht gefunden', 404, "api.errors.tastingNotFound");
    bottling.tastings.splice(index, 1);
    detachTastings(collection, [tastingId]);

    bottling.updatedAt = now();
    return {ok: true};
  });
}
