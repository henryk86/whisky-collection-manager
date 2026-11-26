/**
 * Collection-wide preferences are stored in settings.json and its full backups.
 */
import {change} from '../storage/collection-store.js';
import {assert} from '../domain/errors.js';
import {normalizeSavedViews} from '../../shared/collection-saved-views.js';

/**
 * Updates settings for settings.
 *
 * @param {*} input Input to process.
 * @return {!Promise<!Object>} Persisted collection settings.
 */
export async function updateSettings(input) {
  assert(
    input !== null && typeof input === 'object' && !Array.isArray(input) && Object.keys(input).length === 1 && Object.hasOwn(input, 'establishedYear'),
    'Nur das Gründungsjahr kann hier geändert werden',
    400,
    "api.errors.onlyFoundingYearEditable"
  );
  const year = input.establishedYear;
  assert(
    year === null || (Number.isSafeInteger(year) && year >= 1600 && year <= new Date().getFullYear()),
    'Gründungsjahr muss zwischen 1600 und dem aktuellen Jahr liegen',
    400,
    "api.errors.foundingYearMustBeBetween1600AndTheCurrentYear"
  );
  return change(collection => {
    collection.settings = {...collection.settings, establishedYear: year};
    return collection.settings;
  });
}

/**
 * Saved collection views live in settings.json; validated and backed up with
 * it.
 *
 * @param {*} input Input to process.
 * @return {!Promise<(undefined|!Object)>} Updated collection settings containing the normalized saved views.
 */
export async function updateSavedViews(input) {
  assert(
    input && typeof input === 'object' && !Array.isArray(input) && Object.keys(input).length === 1 && Object.hasOwn(input, 'views'),
    'Ungültige gespeicherte Ansichten',
    400,
    'api.errors.invalidCollectionSettings'
  );
  let views;
  try {views = normalizeSavedViews(input.views);}
  catch {
    assert(false, 'Ungültige gespeicherte Ansichten', 400, 'api.errors.invalidCollectionSettings');
  }
  return change(collection => {
    collection.settings = {...collection.settings, savedViews: views};
    return collection.settings;
  });
}
