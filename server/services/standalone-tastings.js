/** CRUD for a single tasting of a whisky outside the collection. */
import {read, change} from '../storage/collection-store.js';
import {uid, now} from '../domain/collection.js';
import {fail} from '../domain/errors.js';
import {detachTastings} from '../../shared/tasting-flights.js';
import {normalizeStandaloneTasting} from '../../shared/standalone-tastings.js';
import {normalizeTastingRecord, VALID_TASTING_FIELDS}
  from '../../shared/tasting-records.js';

/**
 * Validates the clean state and rejects invalid inputs.
 *
 * @param {*} input Input element or value to inspect.
 * @param {*} old Value used by this operation.
 * @return {*} Value returned by the delegated operation.
 */
function clean(input, old) {
  try {return normalizeStandaloneTasting(input, old);}
  catch (error) {
    throw fail(error.message, 400, "api.errors.invalidTastingData");
  }
}

/**
 * Validates the find state and rejects invalid inputs.
 *
 * @param {*} collection Collection data to process.
 * @param {*} id Identifier of the affected record.
 * @return {*} Result computed from the supplied inputs.
 */
function find(collection, id) {
  const record = (collection.externalTastings || []).find(x => x.id === id);
  if (!record) throw fail('Verkostung nicht gefunden', 404, "api.errors.tastingNotFound");
  return record;
}

/**
 * Returns standalone tasting records under the active filters.
 *
 * @return {!Array<!Object>} Resulting list of values.
 */
export function list() {return read().externalTastings || [];}

/**
 * Retrieves the standalone tastings state.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @return {*} Value returned by the delegated operation.
 */
export function get(id) {return find(read(), id);}

/**
 * Creates the standalone tastings state.
 *
 * @param {*} input Input to process.
 * @return {!Promise<*>} Promise fulfilled when the operation completes.
 */
export function create(input) {
  return change(collection => {
    const timestamp = now();
    const record = {
      ...clean(input), id: uid(), createdAt: timestamp,
      updatedAt: timestamp,
    };
    if (!collection.externalTastings) collection.externalTastings = [];
    collection.externalTastings.push(record);
    return record;
  });
}

/**
 * Updates the standalone tastings state.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @param {*} input Input to process.
 * @return {!Promise<*>} Promise fulfilled when the operation completes.
 */
export function update(id, input) {
  return change(collection => {
    const record = find(collection, id);
    Object.assign(record, clean(input, record), {updatedAt: now()});
    return record;
  });
}

/**
 * Clears the standalone tastings state.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @return {!Promise<!Object>} Promise fulfilled when the operation completes.
 */
export function remove(id) {
  return change(collection => {
    find(collection, id);
    collection.externalTastings.splice(collection.externalTastings.findIndex(x => x.id === id), 1);
    detachTastings(collection, [id]);
    return {ok: true};
  });
}

/**
 * Attach an independent tasting to an existing collection bottling,
 * atomically. No new inventory bottling is created, and an external record is
 * never copied.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @param {*} input Input to process.
 * @return {!Promise<!Object>} Promise fulfilled when the operation completes.
 */
export function assignToBottling(id, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 1 || typeof input.bottlingId !== 'string' || !input.bottlingId.trim())
    throw fail('Ungültige Abfüllungszuordnung', 400, "api.errors.invalidBottlingAssignment");
  return change(collection => {
    const tasting = find(collection, id);
    const bottling = (collection.bottlings || []).find(b => b.id === input.bottlingId);
    if (!bottling) throw fail('Abfüllung nicht gefunden', 404, "api.errors.bottlingNotFound");
    if ((bottling.tastings || []).some(item => item.id === id)) throw fail('Verkostung bereits zugeordnet', 409, "api.errors.tastingAlreadyAssigned");
    const fields = Object.fromEntries(VALID_TASTING_FIELDS.map(key => [key, tasting[key]]));
    const moved = {
      ...normalizeTastingRecord(fields), id: tasting.id,
      createdAt: tasting.createdAt, updatedAt: tasting.updatedAt,
    };
    if (!Array.isArray(bottling.tastings)) bottling.tastings = [];
    bottling.tastings.push(moved);

    bottling.updatedAt = now();
    collection.externalTastings.splice(collection.externalTastings.findIndex(x => x.id === id), 1);
    return {bottlingId: bottling.id, tastingId: id};
  });
}
