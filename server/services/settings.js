/** Collection-wide preferences are part of collection.json and its full backups. */
import { change } from '../storage/collection-store.js';
import { assert } from '../domain/errors.js';

export async function updateSettings(input) {
    assert(input !== null && typeof input === 'object' && !Array.isArray(input) &&
        Object.keys(input).length === 1 && Object.hasOwn(input, 'establishedYear'),
        'Nur das Gründungsjahr kann hier geändert werden');
    const year = input.establishedYear;
    assert(year === null || (Number.isSafeInteger(year) && year >= 1600 && year <= new Date().getFullYear()),
        'Gründungsjahr muss zwischen 1600 und dem aktuellen Jahr liegen');
    return change(collection => {
        collection.settings = { ...collection.settings, establishedYear: year };
        return collection.settings;
    });
}
