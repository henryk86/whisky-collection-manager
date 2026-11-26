import {change} from '../storage/collection-store.js';
import {requireField} from '../domain/validation.js';
import {uid} from '../domain/collection.js';
import {fail} from '../domain/errors.js';
/**
 * Accepts an absent coordinate pair or validates latitude and longitude bounds.
 * @param {Object} input Untrusted distillery location fields.
 * @return {{latitude: (?number), longitude: (?number)}} Validated coordinates or two nulls.
 */
function locationFromInput(input) {
  const lat = input.latitude, lon = input.longitude;
  if (lat == null && lon == null) return {latitude: null, longitude: null};
  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90 || typeof lon !== 'number' || !Number.isFinite(lon) || lon < -180 ||
    lon > 180) {
    throw fail(
      'Breitengrad und Längengrad müssen gültige Zahlen sein',
      400,
      "api.errors.latitudeAndLongitudeMustBeValidNumbers"
    );
  }
  return {latitude: lat, longitude: lon};
}

/**
 * Normalizes the proposed distillery name and rejects a case-insensitive duplicate.
 * @param {import('../../shared/types.js').Collection} collection Current collection.
 * @param {*} value Proposed name.
 * @param {?string=} currentId Distillery ID excluded during rename.
 * @return {string} Trimmed unique distillery name.
 */
function uniqueName(collection, value, currentId = null) {
  const name = requireField(value, 'distilleryName');
  const duplicate = collection.distilleries.some(entry => entry.id !== currentId && entry.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    throw fail('Destillerie existiert bereits', 409, "api.errors.distilleryAlreadyExists");
  }
  return name;
}

/**
 * Rejects unrecognized distillery operating statuses.
 *
 * @param {*} value Value to process.
 * @return {*} Whether the requested condition is met.
 */
function validStatus(value) {
  if (!['active', 'closed', 'reopened', 'unknown'].includes(value)) throw fail('Ungültiger Destilleriestatus', 400, "api.errors.invalidDistilleryStatus");
  return value;
}

/**
 * Creates a distillery with a unique name, validated status and normalized location.
 *
 * @param {*} input Input to process.
 * @return {!Promise<(!Object)>} Newly created distillery, including its unique ID.
 */
export function createDistillery(input) {
  return change(collection => {
    const distillery = {
      id: uid(),
      name: uniqueName(collection, input.name),
      status: validStatus(input.status || 'unknown'),
      ...locationFromInput(input),
    };
    collection.distilleries.push(distillery);
    return distillery;
  });
}

/**
 * Updates the name, status and supplied location of an existing distillery.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @param {*} input Input to process.
 * @return {Promise<import('../../shared/types.js').Distillery>} Updated distillery after the collection change is persisted.
 */
export function updateDistillery(id, input) {
  return change(collection => {
    const distillery = collection.distilleries.find(entry => entry.id === id);
    if (!distillery) {
      throw fail('Destillerie nicht gefunden', 404, "api.errors.distilleryNotFound");
    }
    distillery.name = uniqueName(collection, input.name, id);
    if (Object.hasOwn(input, 'status')) distillery.status = validStatus(input.status);
    if (Object.hasOwn(input, 'latitude') || Object.hasOwn(input, 'longitude')) {
      Object.assign(distillery, locationFromInput(input));
    }
    return distillery;
  });
}
