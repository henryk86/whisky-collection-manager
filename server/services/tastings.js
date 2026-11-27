import {read, change} from '../storage/collection-store.js';
import {now, uid} from '../domain/collection.js';
import {fail} from '../domain/errors.js';
import {detachTastings} from '../../shared/tasting-flights.js';
import {normalizeTastingRecord, sortedTastings}
  from '../../shared/tasting-records.js';
/**
 * Resolves the owned bottling for a tasting operation, or raises a not-found error.
 * @param {import('../../shared/types.js').Collection} collection Collection containing bottlings.
 * @param {string} id Bottling ID.
 * @return {import('../../shared/types.js').Bottling} Matching bottling.
 */
function requireBottling(collection, id) {
  const bottling = collection.bottlings.find(b => b.id === id);
  if (!bottling) throw fail('Abfüllung nicht gefunden', 404, "api.errors.bottlingNotFound");
  return bottling;
}

/**
 * Finds a tasting nested in the specified bottling or raises a not-found error.
 * @param {import('../../shared/types.js').Bottling} bottling Parent bottling.
 * @param {string} tastingId Tasting record ID.
 * @return {import('../../shared/types.js').Tasting} Matching owned tasting.
 */
function requireTasting(bottling, tastingId) {
  const tasting = (bottling.tastings || []).find(entry => entry.id === tastingId);
  if (!tasting) throw fail('Verkostung nicht gefunden', 404, "api.errors.tastingNotFound");
  return tasting;
}

/**
 * Normalizes owned tasting fields and converts validation errors into HTTP 400.
 * @param {*} input Incoming tasting fields.
 * @param {Object=} old Previous tasting fields.
 * @return {Object} Normalized tasting fields.
 */
function clean(input, old) {
  try {return normalizeTastingRecord(input, old);}
  catch (error) {
    throw fail(error.message, 400, "api.errors.invalidTastingData");
  }
}

/**
 * Returns tastings associated with the requested collection scope.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @return {!Array<*>} Saved tastings of the specified bottling in display order.
 */
export function listTastings(id) {
  return sortedTastings(requireBottling(read(), id));
}

/**
 * Retrieves tasting for tastings.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @param {string} tastingId Identifier of the tasting within the selected bottling.
 * @return {*} Tasting record under the specified bottling.
 */
export function getTasting(id, tastingId) {
  return requireTasting(requireBottling(read(), id), tastingId);
}

/**
 * Creates and timestamps a tasting within the specified bottling.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @param {*} input Input to process.
 * @return {!Promise<*>} Created tasting record.
 */
export function createTasting(id, input) {
  return change(collection => {
    const bottling = requireBottling(collection, id);
    const timestamp = now();
    const tasting = {
      ...clean(input), id: uid(), createdAt: timestamp,
      updatedAt: timestamp,
    };
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
 * @param {string} tastingId Identifier of the tasting to update within the selected bottling.
 * @param {*} input Input to process.
 * @return {!Promise<*>} Updated tasting record.
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
 * @param {string} tastingId Identifier of the tasting to remove from the selected bottling.
 * @return {!Promise<!Object>} Success confirmation after deleting the tasting.
 */
export function deleteTasting(id, tastingId) {
  return change(collection => {
    const bottling = requireBottling(collection, id);
    const index = (bottling.tastings || []).findIndex(entry => entry.id === tastingId);
    if (index < 0) throw fail('Verkostung nicht gefunden', 404, "api.errors.tastingNotFound");
    bottling.tastings.splice(index, 1);
    detachTastings(collection, [tastingId]);

    bottling.updatedAt = now();
    return {ok: true};
  });
}
