/** Tasting Flights: one ordered grouping per independently stored tasting. */
import {read, change} from '../storage/collection-store.js';
import {now, uid} from '../domain/collection.js';
import {fail} from '../domain/errors.js';
import {
  normalizeFlightFields, FLIGHT_LIMIT, allTastingReferences,
  flightEntries, validateFlightPlan
} from '../../shared/tasting-flights.js';
import {normalizeTastingRecord} from '../../shared/tasting-records.js';
import {normalizeStandaloneTasting} from '../../shared/standalone-tastings.js';

/**
 * Validates the find state and rejects invalid inputs.
 *
 * @param {*} collection Collection data to process.
 * @param {*} id Identifier of the affected record.
 * @return {*} Result computed from the supplied inputs.
 */
const find = (collection, id) => {
  const flight = (collection.tastingFlights || []).find(f => f.id === id);
  if (!flight) throw fail('Tasting-Flight nicht gefunden', 404,
    "api.errors.flightNotFound");
  return flight;
};

/**
 * Validates the normalize state and rejects invalid inputs.
 *
 * @param {*} body Body content to validate or process.
 * @param {*} old Value used by this operation.
 * @return {*} Value returned by the delegated operation.
 */
const normalize = (body, old) => {
  try {return normalizeFlightFields(body, old);}
  catch (error) {
    throw fail(error.message, 400, "api.errors.invalidTastingData"
    );
  }
};

/**
 * Lists saved tasting flights for the requesting user.
 *
 * @return {!Array<!TastingFlight>} Resulting list of values.
 */
export function list() {return read().tastingFlights || [];}

/**
 * Retrieves the tasting flights state.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @return {*} Value returned by the delegated operation.
 */
export function get(id) {return find(read(), id);}

/**
 * Creates the tasting flights state.
 *
 * @param {*} body Request or response body.
 * @return {!Promise<!Object>} Promise fulfilled when the operation completes.
 */
export function create(body) {
  return change(collection => {
    const when = now();
    const planned = body?.phase === 'planned';
    const metadata = Object.fromEntries(['name', 'date', 'notes']
      .filter(k => Object.hasOwn(body || {}, k)).map(k => [k, body[k]]));
    if (!planned && (Object.hasOwn(body || {}, 'phase') ||
      Object.hasOwn(
        body ||
        {},
        'planItems'
      ))) throw fail('Ungültige Flight-Planung', 400,
        'api.errors.invalidFlight');
    const flight = {
      id: uid(),
      ...normalize(metadata),
      tastingIds: [],
      createdAt: when,
      updatedAt: when,
    };
    if (planned) {
      flight.phase = 'planned'; flight.planItems = body.planItems;
      try {validateFlightPlan(collection, flight);} catch {
        throw fail(
          'Ungültige Flight-Planung', 400, 'api.errors.invalidFlight');
      }
      if (!flight.planItems.length || flight.planItems.some(item =>
        !collection.bottlings.some(b => b.id === item.bottlingId &&
          b.bottles?.some(x => x.id === item.bottleId && x.status !==
            'empty'))))
        throw fail(
          'Geplante Flasche ist nicht verfügbar',
          400,
          'api.errors.invalidFlight'
        );
    }
    (collection.tastingFlights ||= []).push(flight);
    return flight;
  });
}

/**
 * Updates the tasting flights state.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @param {*} body Request or response body.
 * @return {!Promise<*>} Promise fulfilled when the operation completes.
 */
export function update(id, body) {
  return change(collection => {
    const flight = find(collection, id);
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(k =>
        !['name', 'date', 'notes', 'phase', 'planItems'].includes(k)))
      throw fail('Ungültiger Flight', 400, 'api.errors.invalidFlight');
    const metadata = Object.fromEntries(['name', 'date', 'notes']
      .filter(k => Object.hasOwn(body, k)).map(k => [k, body[k]]));
    if (Object.keys(metadata).length) Object.assign(
      flight,
      normalize(
        metadata,
        {name: flight.name, date: flight.date, notes: flight.notes}
      )
    );
    if (Object.hasOwn(body, 'planItems')) {
      if (flight.phase !== 'planned') throw fail(
        'Nur geplante Flights sind umstellbar',
        400,
        'api.errors.invalidFlight'
      );
      flight.planItems = body.planItems;
    }
    if (Object.hasOwn(body, 'phase')) {
      if (flight.phase === 'planned' && body.phase === 'inProgress' &&
        flight.planItems.length &&
        flight.planItems.every(item => collection.bottlings.some(b =>
          b.id === item.bottlingId &&
          b.bottles?.some(x => x.id === item.bottleId && x.status !==
            'empty')))) flight.phase = 'inProgress';
      else if (flight.phase === 'inProgress' && body.phase ===
        'completed' && flight.tastingIds.length) flight.phase = 'completed';
      else throw fail(
        'Ungültiger Flight-Statuswechsel',
        400,
        'api.errors.invalidFlight'
      );
    }
    try {validateFlightPlan(collection, flight);} catch {
      throw fail(
        'Ungültige Flight-Planung', 400, 'api.errors.invalidFlight');
    }
    flight.updatedAt = now();
    return flight;
  });
}

/**
 * Clears the tasting flights state.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @return {!Promise<!Object>} Promise fulfilled when the operation completes.
 */
export function remove(id) {
  return change(collection => {
    const flight = find(collection, id);
    collection.tastingFlights.splice(
      collection.tastingFlights.indexOf(flight),
      1
    );
    return {ok: true}; // Never delete tasting records.
  });
}

/**
 * Validates available for tasting flights.
 *
 * @param {!Object} collection Collection data being processed.
 * @param {*} flight Flight used by this operation.
 * @param {!Array<*>} ids Identifiers in their current order.
 */
function assertAvailable(collection, flight, ids) {
  if (!Array.isArray(ids) || ids.length > FLIGHT_LIMIT ||
    ids.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/
      .test(id)) ||
    new Set(ids).size !== ids.length) throw fail(
      'Ungültige Flight-Reihenfolge',
      400,
      "api.errors.invalidFlightOrder"
    );
  const refs = allTastingReferences(collection);
  for (const id of ids) {
    if (refs.filter(item => item.record.id === id).length !== 1) throw fail(
      'Verkostung nicht gefunden oder nicht eindeutig',
      400,
      "api.errors.tastingNotUniqueOrMissing"
    );
    if ((collection.tastingFlights || []).some(other => other.id !==
      flight.id && other.tastingIds.includes(id)))
      throw fail(
        'Verkostung gehört bereits zu einem anderen Flight',
        409,
        "api.errors.tastingAlreadyInOtherFlight"
      );
  }
}

/**
 * Updates the ordered tasting references belonging to a flight.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @param {*} body Request or response body.
 * @return {!Promise<*>} Promise fulfilled when the operation completes.
 */
export function setTastings(id, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    !Object.hasOwn(body, 'tastingIds')) throw fail(
      'Ungültige Flight-Reihenfolge',
      400,
      "api.errors.invalidFlightOrder"
    );
  return change(collection => {
    const flight = find(collection, id);
    if (flight.phase === 'planned' || flight.phase === 'completed') throw fail(
      'Flight ist nicht in Durchführung',
      400,
      'api.errors.invalidFlight'
    );
    assertAvailable(collection, flight, body.tastingIds);
    if (flight.phase === 'inProgress') {
      const planned = new Set(flight.planItems.map(item => item.bottlingId));
      const refs = allTastingReferences(collection);
      const selected = body.tastingIds.map(id => refs.find(item =>
        item.record.id === id));
      if (selected.some(item => !item || item.external ||
        !planned.has(item.bottling.id)) ||
        new Set(selected.map(item => item.bottling.id)).size !==
        selected.length)
        throw fail(
          'Verkostung ist nicht Teil dieses Plans',
          400,
          'api.errors.invalidFlight'
        );
    }
    flight.tastingIds = [...body.tastingIds];
    flight.updatedAt = now();
    return flight;
  });
}

/**
 * Create a single tasting in a flight in one atomic write (also for unowned
 * whiskies).
 *
 * @param {string} id Identifier used to select the relevant record.
 * @param {*} body Request or response body.
 * @return {!Promise<!Object>} Promise fulfilled when the operation completes.
 */
export function createTasting(id, body) {
  if (!body || typeof body !== 'object' ||
    Array.isArray(body)) throw fail(
      'Ungültige Verkostungsdaten',
      400,
      "api.errors.invalidTastingData"
    );
  return change(collection => {
    const flight = find(collection, id);
    if (flight.phase === 'planned' || flight.phase === 'completed') throw fail(
      'Flight ist nicht in Durchführung',
      400,
      'api.errors.invalidFlight'
    );
    if (flight.tastingIds.length >= FLIGHT_LIMIT) throw fail(
      'Flight enthält zu viele Verkostungen',
      400,
      "api.errors.flightTooManyTastings"
    );
    const {bottlingId, bottling, ...data} = body;
    if ((bottlingId == null) === (bottling == null)) throw fail(
      'Abfüllung muss eindeutig gewählt werden',
      400,
      "api.errors.bottlingSelectionRequired"
    );
    if (flight.phase === 'inProgress' && (bottling || !flight.planItems
      .some(item => item.bottlingId === bottlingId) ||
      allTastingReferences(collection).some(item => flight.tastingIds
        .includes(item.record.id) && item.bottling?.id === bottlingId)))
      throw fail(
        'Abfüllung ist nicht Teil des Plans oder wurde bereits verkostet',
        400,
        'api.errors.invalidFlight'
      );
    let normalized, owned;
    try {
      if (bottlingId != null) {
        if (typeof bottlingId !==
          'string') throw new Error('Ungültige Abfüllung');
        owned = collection.bottlings.find(b => b.id === bottlingId);
        if (!owned) throw fail(
          'Abfüllung nicht gefunden',
          404,
          "api.errors.bottlingNotFound"
        );
        normalized = normalizeTastingRecord(data);
      } else normalized = normalizeStandaloneTasting({...data, bottling});
    } catch (error) {
      if (error.status) throw error; throw fail(error.message,
        400, "api.errors.invalidTastingData");
    }
    const timestamp = now();
    const record = {
      ...normalized, id: uid(), createdAt: timestamp,
      updatedAt: timestamp,
    };
    if (owned) {
      (owned.tastings ||= []).push(record);

      owned.updatedAt = timestamp;
    } else (collection.externalTastings ||= []).push(record);
    flight.tastingIds.push(record.id);
    flight.updatedAt = timestamp;
    return {record, bottlingId: owned?.id || null};
  });
}
