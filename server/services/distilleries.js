import {change} from '../storage/collection-store.js';
import {requireField} from '../domain/validation.js';
import {uid} from '../domain/collection.js';
import {fail} from '../domain/errors.js';
/**
 * Derives the location from input numeric value from its input.
 *
 * @param {*} input Input element or value to inspect.
 * @return {!Object} Structured result assembled from the input data.
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
 * Normalizes the unique name text for subsequent processing.
 *
 * @param {*} collection Collection data to process.
 * @param {*} value Value to process.
 * @param {*=} currentId Value used by this operation.
 * @return {*} Whether the requested condition is met.
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
 * Validates the valid status state and rejects invalid inputs.
 *
 * @param {*} value Value to process.
 * @return {*} Whether the requested condition is met.
 */
function validStatus(value) {
  if (!['active', 'closed', 'reopened', 'unknown'].includes(value)) throw fail('Ungültiger Destilleriestatus', 400, "api.errors.invalidDistilleryStatus");
  return value;
}

/**
 * Creates distillery for distilleries.
 *
 * @param {*} input Input to process.
 * @return {!Promise<(!Object)>} Promise fulfilled when the operation
 * completes.
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
 * Updates distillery for distilleries.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @param {*} input Input to process.
 * @return {!Promise<!Distillery>} Promise fulfilled when the operation
 * completes.
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
