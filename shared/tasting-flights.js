/**
 * Optional tasting session: ordered references, never copies of scores or
 * notes.
 */
import {validTastingDate} from './tasting-records.js';

export const FLIGHT_LIMIT = 100;
/**
 * Normalizes flight fields for tasting flights.
 *
 * @param {*} input Input to process.
 * @param {!Object=} previous Previous used by this operation.
 * @return {!Object} Structured result for the caller.
 */
export function normalizeFlightFields(input, previous = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
    Object.keys(input).some(key => !['name', 'date', 'notes'].includes(key)))
    throw new Error('Ungültige Flight-Daten');
  const value = {name: '', date: '', notes: '', ...previous, ...input};
  if (typeof value.name !== 'string' || !value.name.trim() || value.name
    .length > 160)
    throw new Error('Ungültiger Flight-Name');
  if (!validTastingDate(value.date)) throw new Error('Ungültiges Flight-Datum');
  if (typeof value.notes !== 'string' || value.notes.length > 10000)
    throw new Error('Ungültige Flight-Notiz');
  return {name: value.name.trim(), date: value.date, notes: value.notes};
}

/**
 * Collects referenced tasting IDs across the saved flights.
 *
 * @param {!Object} collection Collection data being processed.
 * @return {!Array<*>} Resulting list of values.
 */
export function allTastingReferences(collection) {
  return [
    ...(collection.bottlings || []).flatMap(b => (b.tastings || [])
      .map(record => ({record, bottling: b, external: false}))),
    ...(collection.externalTastings || []).map(record =>
      ({record, bottling: record.bottling, external: true})),
  ];
}

/**
 * Resolves a flight's referenced tasting records in display order.
 *
 * @param {!Object} collection Collection data being processed.
 * @param {*} flight Flight used by this operation.
 * @return {*} Entries that meet the selection criteria.
 */
export function flightEntries(collection, flight) {
  const refs = allTastingReferences(collection);
  return (flight?.tastingIds || []).map(id => refs.find(ref => ref.record
    .id === id)).filter(Boolean);
}

/**
 * Finds the flight containing a given tasting ID.
 *
 * @param {!Object} collection Collection data being processed.
 * @param {*} tastingId Tasting id used by this operation.
 * @return {*} Whether the requested condition is met.
 */
export function flightForTasting(collection, tastingId) {
  return (collection?.tastingFlights || []).find(flight => flight.tastingIds
    .includes(tastingId)) || null;
}

/**
 * Remove references after deleting a tasting/bottling, without deleting the
 * flight.
 *
 * @param {!Object} collection Collection data being processed.
 * @param {!Array<*>} ids Identifiers in their current order.
 */
export function detachTastings(collection, ids) {
  const deleted = new Set(ids);
  if (!deleted.size) return;
  for (const flight of collection.tastingFlights || []) {
    if (flight.tastingIds.some(id => deleted.has(id))) {
      flight.tastingIds = flight.tastingIds.filter(id => !deleted.has(id));
      flight.updatedAt = new Date().toISOString();
    }
  }
}

/**
 * Planned members reference physical bottles, never fabricated tasting records.
 */
export const FLIGHT_PHASES =
  Object.freeze(['planned', 'inProgress', 'completed']);
export const PLAN_LIMIT = 6;
/**
 * Validates flight plan for tasting flights.
 *
 * @param {!Object} collection Collection data being processed.
 * @param {*} flight Flight used by this operation.
 * @return {boolean} Whether the condition is satisfied.
 */
export function validateFlightPlan(collection, flight) {
  if (flight.phase === undefined && flight.planItems ===
    undefined) return true; // legacy flights
  if (!FLIGHT_PHASES.includes(flight.phase) ||
    !Array.isArray(flight.planItems) ||
    flight.planItems.length >
    PLAN_LIMIT) throw new Error('Invalid flight plan');
  const seen = new Set();
  for (const item of flight.planItems) {
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
      Object.keys(item).some(k => !['bottlingId', 'bottleId', 'reason']
        .includes(k)) ||
      typeof item.bottlingId !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/
        .test(item.bottlingId) ||
      typeof item.bottleId !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/
        .test(item.bottleId) ||
      seen.has(item.bottlingId) || (item.reason !== undefined &&
        ![
          'noProfile',
          'untried',
          'contrast',
          'similar',
          'intensity',
          'manual',
        ].includes(item.reason))) throw new Error('Invalid planned item');
    seen.add(item.bottlingId);
    // Missing bottles are retained in old plans and explicitly highlighted in
    // the UI.
  }
  if (flight.phase === 'planned' &&
    flight.tastingIds?.length) throw new Error(
      'Planning may not contain tastings');
  // Existing records may be removed later; a completed flight must remain valid
  // even when its last tasting is deleted. The transition itself requires a
  // tasting.
  return true;
}
